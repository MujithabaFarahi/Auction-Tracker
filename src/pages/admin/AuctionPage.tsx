import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount } from "@/lib/format";
import {
  auctionStateDocRef,
  deleteBidAtIndex,
  ensureAuctionState,
  markPlayerSold,
  placeBid,
  playersCollectionRef,
  setCurrentPlayer,
  startAuction,
  teamsCollectionRef,
  type AuctionState,
  type Player,
  type Team,
} from "@/lib/firestore";

function AuctionPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [differenceAmount, setDifferenceAmount] = useState("1000");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void ensureAuctionState();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(teamsCollectionRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Team, "id">),
      }));
      setTeams(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(playersCollectionRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Player, "id">),
      }));
      setPlayers(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(auctionStateDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setAuctionState(null);
        return;
      }
      setAuctionState(snapshot.data() as AuctionState);
    });
    return () => unsubscribe();
  }, []);

  const availablePlayers = useMemo(
    () => players.filter((player) => player.status === "AVAILABLE"),
    [players],
  );

  const currentPlayer = useMemo(
    () =>
      players.find((player) => player.id === auctionState?.currentPlayerId) ??
      null,
    [players, auctionState?.currentPlayerId],
  );

  const leadingTeam = useMemo(
    () =>
      teams.find((team) => team.id === auctionState?.leadingTeamId) ?? null,
    [teams, auctionState?.leadingTeamId],
  );

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const bidHistory = auctionState?.bidHistory ?? [];
  const auctionLive = auctionState?.status === "LIVE";
  const lastBidTeamId = bidHistory.length
    ? bidHistory[bidHistory.length - 1].teamId
    : null;

  const differenceValue = Number(differenceAmount) || 0;
  const currentBidValue = Number(auctionState?.currentBid ?? 0);
  const basePrice = Number(currentPlayer?.basePrice ?? 0);
  const minBid = Math.max(basePrice, currentBidValue + differenceValue);

  useEffect(() => {
    const currentBidInput = Number(bidAmount || 0);
    if (!auctionLive) {
      return;
    }
    if (!bidAmount || Number.isNaN(currentBidInput) || currentBidInput < minBid) {
      setBidAmount(minBid ? String(minBid) : "");
    }
  }, [auctionLive, bidAmount, minBid]);

  const handleSelectPlayer = async () => {
    if (!selectedPlayerId) {
      setStatusMessage("Select a player to start the auction.");
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await setCurrentPlayer(selectedPlayerId);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to set current player.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartAuction = async () => {
    if (!auctionState?.currentPlayerId) {
      setStatusMessage("Select a player before starting the auction.");
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await startAuction();
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to start auction.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlaceBid = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    const amount = Number(bidAmount);
    if (!selectedTeamId || amount <= 0) {
      setStatusMessage("Select a team and enter a valid bid amount.");
      return;
    }
    if (Number.isNaN(differenceValue) || differenceValue <= 0) {
      setStatusMessage("Enter a valid bid difference amount.");
      return;
    }
    if (lastBidTeamId && selectedTeamId === lastBidTeamId) {
      setStatusMessage("Same team cannot bid twice in a row.");
      return;
    }
    if (amount < minBid) {
      setStatusMessage(
        `Bid must be at least ${formatAmount(minBid)}.`,
      );
      return;
    }
    if (selectedTeam && selectedTeam.remainingPurse < amount) {
      setStatusMessage("Team purse is insufficient for this bid.");
      return;
    }
    setSubmitting(true);
    try {
      await placeBid(selectedTeamId, amount);
      setBidAmount("");
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to place bid.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSold = async () => {
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await markPlayerSold();
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to mark player sold.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBid = async (index: number) => {
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await deleteBidAtIndex(index);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to delete bid.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Auction Control
              {auctionState ? <Badge>{auctionState.status}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-player">Select player</Label>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedPlayerId}
                  onValueChange={setSelectedPlayerId}
                  disabled={auctionLive || submitting}
                >
                  <SelectTrigger
                    id="current-player"
                    className="min-w-[240px] flex-1"
                  >
                    <SelectValue placeholder="Select an available player" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlayers.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name} · {player.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectPlayer}
                  disabled={auctionLive || submitting}
                >
                  Load player
                </Button>
                <Button
                  type="button"
                  onClick={handleStartAuction}
                  disabled={auctionLive || submitting}
                >
                  Start auction
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Current player
                </p>
                <p className="text-base font-semibold">
                  {currentPlayer ? currentPlayer.name : "Not selected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentPlayer ? currentPlayer.role : "Awaiting selection"}
                </p>
                <p className="text-sm">
                  Base price:{" "}
                  <span className="font-medium">
                    {currentPlayer ? formatAmount(currentPlayer.basePrice) : "-"}
                  </span>
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Current bid
                </p>
                <p className="text-2xl font-semibold">
                  {formatAmount(auctionState?.currentBid ?? 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Leading team: {leadingTeam ? leadingTeam.name : "None"}
                </p>
              </div>
            </div>

            <form className="space-y-3" onSubmit={handlePlaceBid}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bid-team">Bid team</Label>
                  <Select
                    value={selectedTeamId}
                    onValueChange={setSelectedTeamId}
                    disabled={!auctionLive || submitting}
                  >
                    <SelectTrigger id="bid-team">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem
                        key={team.id}
                        value={team.id}
                        disabled={team.id === lastBidTeamId}
                      >
                        {team.name} · {formatAmount(team.remainingPurse)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bid-amount">Bid amount</Label>
                  <Input
                    id="bid-amount"
                    type="number"
                    min={minBid}
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    disabled={!auctionLive || submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: {formatAmount(minBid)}
                    {selectedTeam ? ` · Remaining: ${formatAmount(selectedTeam.remainingPurse)}` : ""}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-[200px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="bid-diff">Bid difference</Label>
                  <Input
                    id="bid-diff"
                    type="number"
                    min={1}
                    value={differenceAmount}
                    onChange={(event) => setDifferenceAmount(event.target.value)}
                    disabled={!auctionLive || submitting}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  {[1000, 2000, 5000, 10000].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      onClick={() => setDifferenceAmount(String(value))}
                      disabled={!auctionLive || submitting}
                    >
                      +{formatAmount(value)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={!auctionLive || submitting}>
                  Place bid
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleMarkSold}
                  disabled={!auctionLive || submitting}
                >
                  Mark SOLD
                </Button>
              </div>
            </form>

            {statusMessage ? (
              <p className="text-sm text-destructive">{statusMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bid History</CardTitle>
          </CardHeader>
          <CardContent>
            {bidHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bids yet. Bids will appear live here.
              </p>
            ) : (
              <div className="space-y-2">
                {bidHistory.map((bid, index) => (
                  <div
                    key={`${bid.teamId}-${bid.timestamp}-${index}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{bid.teamName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {formatAmount(bid.amount)}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() => handleDeleteBid(index)}
                        disabled={submitting}
                        aria-label="Delete bid"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Add teams in setup to track budgets.
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>{team.name}</TableCell>
                    <TableCell>{formatAmount(team.totalPurse)}</TableCell>
                    <TableCell>{formatAmount(team.remainingPurse)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuctionPage;
