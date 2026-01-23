import { useEffect, useMemo, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount, formatTeamLabel } from "@/lib/format";
import { LiveInfoCard } from "@/components/auction/LiveInfoCard";
import { TeamCard } from "@/components/auction/TeamCard";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [playerCommandOpen, setPlayerCommandOpen] = useState(false);
  const lastSuggestedBidRef = useRef<number>(0);

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
    () =>
      players
        .filter((player) => player.status === "AVAILABLE")
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [players],
  );

  const currentPlayer = useMemo(
    () =>
      players.find((player) => player.id === auctionState?.currentPlayerId) ??
      null,
    [players, auctionState?.currentPlayerId],
  );

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const leadingTeam = useMemo(
    () => teams.find((team) => team.id === auctionState?.leadingTeamId) ?? null,
    [teams, auctionState?.leadingTeamId],
  );

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const teamStats = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((player) => {
      if (player.status === "SOLD" && player.soldToTeamId) {
        counts[player.soldToTeamId] = (counts[player.soldToTeamId] ?? 0) + 1;
      }
    });
    return teams.map((team) => ({
      ...team,
      playersCount: counts[team.id] ?? 0,
    }));
  }, [teams, players]);

  const bidHistory = auctionState?.bidHistory ?? [];
  const auctionLive = auctionState?.status === "LIVE";
  const lastBidTeamId = bidHistory.length
    ? bidHistory[bidHistory.length - 1].teamId
    : null;
  const currentBidAmount = Number(auctionState?.currentBid ?? 0);

  const differenceValue = Math.max(1000, Number(differenceAmount) || 0);
  const basePrice = Number(currentPlayer?.basePrice ?? 0);
  const minBid = Math.max(basePrice, currentBidAmount + differenceValue);

  useEffect(() => {
    if (auctionState?.currentPlayerId) {
      setDifferenceAmount("1000");
      lastSuggestedBidRef.current = 0;
    }
  }, [auctionState?.currentPlayerId]);

  useEffect(() => {
    const currentBidInput = Number(bidAmount || 0);
    if (!auctionLive) {
      return;
    }
    const shouldAutofill =
      !bidAmount ||
      Number.isNaN(currentBidInput) ||
      currentBidInput < minBid ||
      currentBidInput === lastSuggestedBidRef.current;
    if (shouldAutofill) {
      setBidAmount(minBid ? String(minBid) : "");
      lastSuggestedBidRef.current = minBid;
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
      setStatusMessage(`Bid must be at least ${formatAmount(minBid)}.`);
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
      setSelectedTeamId("");
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to place bid.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSold = async () => {
    if (!auctionState?.currentPlayerId || !currentPlayer) {
      setStatusMessage("Select a player before marking sold.");
      return;
    }
    if (!leadingTeam) {
      setStatusMessage("No leading team yet. Place a bid first.");
      return;
    }
    if (!currentBidAmount) {
      setStatusMessage("Bid amount must be greater than 0 to mark sold.");
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await markPlayerSold();
      const nextPlayer = availablePlayers.find(
        (player) => player.id !== auctionState?.currentPlayerId,
      );
      if (nextPlayer) {
        await setCurrentPlayer(nextPlayer.id);
        setSelectedPlayerId(nextPlayer.id);
      } else {
        setSelectedPlayerId("");
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to mark player sold.",
      );
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const adjustDifference = (delta: number) => {
    setDifferenceAmount((prev) => {
      const current = Number(prev) || 0;
      const next = Math.max(1000, current + delta);
      const rounded = Math.round(next / 1000) * 1000;
      return String(rounded);
    });
  };

  const normalizeDifference = (value: string) => {
    const numericValue = Number(value) || 0;
    const rounded = Math.round(numericValue / 1000) * 1000;
    return String(Math.max(1000, rounded));
  };

  const canMarkSold =
    auctionLive &&
    !submitting &&
    Boolean(currentPlayer) &&
    Boolean(leadingTeam) &&
    currentBidAmount > 0;

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
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-60 flex-1 justify-between"
                  onClick={() => setPlayerCommandOpen(true)}
                  disabled={auctionLive || submitting}
                >
                  {selectedPlayer
                    ? `${selectedPlayer.name} · ${selectedPlayer.role}`
                    : "Select an available player"}
                </Button>
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
              <CommandDialog
                open={playerCommandOpen}
                onOpenChange={setPlayerCommandOpen}
                title="Select player"
                description="Search available players"
              >
                <CommandInput placeholder="Search players..." />
                <CommandList>
                  <CommandEmpty>No available players found.</CommandEmpty>
                  <CommandGroup>
                    {availablePlayers.map((player) => (
                      <CommandItem
                        key={player.id}
                        value={`${player.name} ${player.role}`}
                        onSelect={() => {
                          setSelectedPlayerId(player.id);
                          setPlayerCommandOpen(false);
                        }}
                      >
                        <span className="font-medium">{player.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {player.role}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </CommandDialog>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <LiveInfoCard
                title="Current player"
                primary={currentPlayer ? currentPlayer.name : "Not selected"}
                secondary={
                  currentPlayer ? currentPlayer.role : "Awaiting selection"
                }
                meta={
                  <div className="space-y-0.5">
                    <p>
                      Base price:{" "}
                      <span className="font-medium">
                        {currentPlayer
                          ? formatAmount(currentPlayer.basePrice)
                          : "-"}
                      </span>
                    </p>
                    {currentPlayer?.regularTeam ? (
                      <p className="text-muted-foreground">
                        Regular team:{" "}
                        <span className="font-medium text-foreground">
                          {currentPlayer.regularTeam}
                        </span>
                      </p>
                    ) : null}

                    {currentPlayer?.contactNumber ? (
                      <p className="text-muted-foreground">
                        Contact number:{" "}
                        <span className="font-medium text-foreground">
                          {currentPlayer.contactNumber}
                        </span>
                      </p>
                    ) : null}
                  </div>
                }
              />
              <LiveInfoCard
                title="Current bid"
                primary={formatAmount(auctionState?.currentBid ?? 0)}
                secondary={`Leading team: ${
                  leadingTeam ? formatTeamLabel(leadingTeam) : "None"
                }`}
              />
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
                          {formatTeamLabel(team)} ·{" "}
                          {formatAmount(team.remainingPurse)}
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
                    {selectedTeam
                      ? ` · Remaining: ${formatAmount(selectedTeam.remainingPurse)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bid-diff">Bid difference</Label>
                  <Input
                    id="bid-diff"
                    type="number"
                    min={1000}
                    step={1000}
                    value={differenceAmount}
                    onChange={(event) =>
                      setDifferenceAmount(event.target.value)
                    }
                    onBlur={(event) =>
                      setDifferenceAmount(
                        normalizeDifference(event.target.value),
                      )
                    }
                    disabled={!auctionLive || submitting}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[-1000, -2000, -5000, -10000].map((value) => (
                    <Button
                      key={`minus-${value}`}
                      type="button"
                      variant="outline"
                      onClick={() => adjustDifference(value)}
                      disabled={!auctionLive || submitting}
                    >
                      {formatAmount(value)}
                    </Button>
                  ))}
                  {[1000, 2000, 5000, 10000].map((value) => (
                    <Button
                      key={`plus-${value}`}
                      type="button"
                      variant="outline"
                      onClick={() => adjustDifference(value)}
                      disabled={!auctionLive || submitting}
                    >
                      +{formatAmount(value)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end py-2">
                <Button
                  type="submit"
                  disabled={!auctionLive || submitting}
                  isLoading={submitting}
                >
                  Place bid
                </Button>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canMarkSold}
                    >
                      Mark SOLD
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm sale</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will finalize the player sale and update team
                        budgets.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="font-medium">Sale summary</p>
                      <p className="text-muted-foreground">
                        Player:{" "}
                        <span className="font-medium text-foreground">
                          {currentPlayer?.name ?? "-"}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Team:{" "}
                        <span className="font-medium text-foreground">
                          {leadingTeam ? formatTeamLabel(leadingTeam) : "-"}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Final price:{" "}
                        <span className="font-medium text-foreground">
                          {formatAmount(currentBidAmount)}
                        </span>
                      </p>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={submitting}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleMarkSold}
                        disabled={!canMarkSold}
                      >
                        Confirm SOLD
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="font-medium">Sale summary</p>
                <p className="text-muted-foreground">
                  Player:{" "}
                  <span className="font-medium text-foreground">
                    {currentPlayer?.name ?? "-"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Team:{" "}
                  <span className="font-medium text-foreground">
                    {leadingTeam ? formatTeamLabel(leadingTeam) : "-"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Final price:{" "}
                  <span className="font-medium text-foreground">
                    {formatAmount(currentBidAmount)}
                  </span>
                </p>
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
                {[...bidHistory].reverse().map((bid, index) => (
                  <div
                    key={`${bid.teamId}-${bid.timestamp}-${index}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {formatTeamLabel(
                        teams.find((team) => team.id === bid.teamId) ?? {
                          id: bid.teamId,
                          name: bid.teamName,
                          captainName: "",
                          totalPurse: 0,
                          remainingPurse: 0,
                          spentAmount: 0,
                        },
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {formatAmount(bid.amount)}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          handleDeleteBid(bidHistory.length - 1 - index)
                        }
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
          {teamStats.length === 0 ? (
            <div className="rounded-lg border bg-background/70 py-6 text-center text-muted-foreground">
              Add teams in setup to track budgets.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {teamStats.map((team) => (
                <TeamCard
                  key={team.id}
                  name={formatTeamLabel(team)}
                  spent={formatAmount(team.spentAmount)}
                  remaining={formatAmount(team.remainingPurse)}
                  playersCount={team.playersCount}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuctionPage;
