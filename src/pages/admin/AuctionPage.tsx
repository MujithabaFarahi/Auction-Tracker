import { useEffect, useMemo, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Repeat, Trash2 } from "lucide-react";
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
import { formatAmount, formatTeamLabel } from "@/lib/format";
import { LiveInfoCard } from "@/components/auction/LiveInfoCard";
import { TeamCard } from "@/components/auction/TeamCard";
import {
  auctionStateDocRef,
  deleteBidAtIndex,
  ensureAuctionState,
  commitPendingBids,
  markPlayerSold,
  markPlayerUnsold,
  playersCollectionRef,
  setCurrentPlayer,
  startAuction,
  stopAuction,
  teamsCollectionRef,
  tournamentDocRef,
  updateLiveBid,
  type AuctionState,
  type Bid,
  type Player,
  type Team,
  type Tournament,
} from "@/lib/firestore";
import { useNavigate } from "react-router-dom";

function AuctionPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [differenceAmount, setDifferenceAmount] = useState("5000");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingBids, setPendingBids] = useState<Bid[]>([]);
  const [syncingBids, setSyncingBids] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [playerCommandOpen, setPlayerCommandOpen] = useState(false);
  const lastSuggestedBidRef = useRef<number>(0);
  const pendingPlayerIdRef = useRef<string | null>(null);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBidsRef = useRef<Bid[]>([]);

  const navigate = useNavigate();

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

  useEffect(() => {
    const unsubscribe = onSnapshot(tournamentDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        setTournament(null);
        return;
      }
      setTournament(snapshot.data() as Tournament);
    });
    return () => unsubscribe();
  }, []);

  const availablePlayers = useMemo(
    () =>
      players
        .filter(
          (player) =>
            player.status === "AVAILABLE" || player.status === "UNSOLD",
        )
        .sort((a, b) => {
          const statusRank = (status: Player["status"]) =>
            status === "UNSOLD" ? 1 : 0;
          const rankDiff = statusRank(a.status) - statusRank(b.status);
          if (rankDiff !== 0) {
            return rankDiff;
          }
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        }),
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

  const teamStats = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((player) => {
      if (
        (player.status === "SOLD" || player.status === "DRAFTED") &&
        player.soldToTeamId
      ) {
        counts[player.soldToTeamId] = (counts[player.soldToTeamId] ?? 0) + 1;
      }
    });
    return teams.map((team) => ({
      ...team,
      playersCount: counts[team.id] ?? 0,
    }));
  }, [teams, players]);

  const getMaxBidForTeam = (team: Team & { playersCount: number }) => {
    if (typeof team.maxBidAmount === "number") {
      return team.maxBidAmount;
    }
    const teamSize = tournament?.teamSize ?? 9;
    const minReserve = 20000;
    const remainingSlots = Math.max(0, teamSize - team.playersCount);
    if (remainingSlots <= 0) {
      return 0;
    }
    return team.remainingPurse - (remainingSlots - 1) * minReserve;
  };

  const bidHistory = useMemo(
    () => auctionState?.bidHistory ?? [],
    [auctionState?.bidHistory],
  );

  const combinedBidHistory = useMemo(
    () => (pendingBids.length ? [...bidHistory, ...pendingBids] : bidHistory),
    [bidHistory, pendingBids],
  );
  const auctionLive = auctionState?.status === "LIVE";
  const lastCombinedBid =
    combinedBidHistory.length > 0
      ? combinedBidHistory[combinedBidHistory.length - 1]
      : null;
  const lastBidTeamId = lastCombinedBid?.teamId ?? null;
  const currentBidAmount =
    lastCombinedBid?.amount ?? Number(auctionState?.currentBid ?? 0);
  const leadingTeamId =
    lastCombinedBid?.teamId ?? auctionState?.leadingTeamId ?? null;
  const leadingTeamCombined =
    teams.find((team) => team.id === leadingTeamId) ?? null;

  const differenceValue = Math.max(5000, Number(differenceAmount) || 0);
  const minBid =
    combinedBidHistory.length === 0
      ? 20000
      : currentBidAmount + differenceValue;
  const forceDiff10000 = currentBidAmount >= 100000;

  useEffect(() => {
    if (auctionState?.currentPlayerId) {
      setDifferenceAmount("5000");
      lastSuggestedBidRef.current = 0;
    }
  }, [auctionState?.currentPlayerId]);

  useEffect(() => {
    if (forceDiff10000 && differenceAmount !== "10000") {
      setDifferenceAmount("10000");
      return;
    }
  }, [forceDiff10000, differenceAmount]);

  useEffect(() => {
    pendingBidsRef.current = pendingBids;
  }, [pendingBids]);

  useEffect(() => {
    if (
      pendingBids.length > 0 &&
      pendingPlayerIdRef.current &&
      auctionState?.currentPlayerId &&
      pendingPlayerIdRef.current !== auctionState.currentPlayerId
    ) {
      pendingBidsRef.current = [];
      setPendingBids([]);
      pendingPlayerIdRef.current = null;
      setStatusMessage(
        "Pending bids cleared because the active player changed.",
      );
    }
  }, [auctionState?.currentPlayerId, pendingBids]);

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

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

  const handleSelectPlayer = async (playerId: string) => {
    if (!playerId) {
      setStatusMessage("Select a player to start the auction.");
      return;
    }
    if (auctionLive) {
      setStatusMessage("Stop the live auction before changing players.");
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await setCurrentPlayer(playerId);
      setSelectedPlayerId(playerId);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to set current player.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getRandomAvailablePlayer = (excludeId?: string) => {
    const pool = excludeId
      ? availablePlayers.filter((player) => player.id !== excludeId)
      : availablePlayers;
    if (pool.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  };

  const handleRandomPlayer = async () => {
    const randomPlayer = getRandomAvailablePlayer();
    if (!randomPlayer) {
      setStatusMessage("No available players to select.");
      return;
    }
    await handleSelectPlayer(randomPlayer.id);
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

  const handleStopAuction = async () => {
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await stopAuction();
      setPendingBids([]);
      pendingBidsRef.current = [];
      pendingPlayerIdRef.current = null;
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to stop auction.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const flushPendingBids = async () => {
    const bidsToCommit = pendingBidsRef.current;
    if (!bidsToCommit.length) {
      return true;
    }
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    const playerId = pendingPlayerIdRef.current;
    if (!playerId) {
      setStatusMessage("Pending bids cannot be synced without a player.");
      return false;
    }
    if (syncingBids) {
      return false;
    }
    setSyncingBids(true);
    setStatusMessage(null);
    try {
      await commitPendingBids(playerId, bidsToCommit);
      pendingBidsRef.current = [];
      setPendingBids([]);
      pendingPlayerIdRef.current = null;
      return true;
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to sync pending bids.",
      );
      return false;
    } finally {
      setSyncingBids(false);
    }
  };

  const scheduleFlush = () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    flushTimeoutRef.current = setTimeout(() => {
      void flushPendingBids();
    }, 800);
  };

  const placeBidForTeam = (teamId: string) => {
    setStatusMessage(null);
    if (!auctionState?.currentPlayerId) {
      setStatusMessage("Select a player before placing a bid.");
      return;
    }
    const latestPendingBid =
      pendingBidsRef.current[pendingBidsRef.current.length - 1];
    const latestTeamId = latestPendingBid?.teamId ?? lastBidTeamId;

    const amount = Number(bidAmount);
    if (!teamId || amount <= 0) {
      setStatusMessage("Select a team and enter a valid bid amount.");
      return;
    }
    if (Number.isNaN(differenceValue) || differenceValue <= 0) {
      setStatusMessage("Enter a valid bid difference amount.");
      return;
    }
    if (latestTeamId && teamId === latestTeamId) {
      setStatusMessage("Same team cannot bid twice in a row.");
      return;
    }

    const team = teamStats.find((item) => item.id === teamId);
    if (!team) {
      setStatusMessage("Team not found.");
      return;
    }
    const maxBid = getMaxBidForTeam(team);
    if (maxBid !== null && amount > maxBid) {
      setStatusMessage(
        `Max bid for this team is ${formatAmount(maxBid)} based on remaining slots.`,
      );
      return;
    }
    if (team.remainingPurse < amount) {
      setStatusMessage("Team purse is insufficient for this bid.");
      return;
    }
    const bid: Bid = {
      teamId,
      teamName: team.name,
      amount,
      timestamp: Date.now(),
    };
    const nextPending = [...pendingBidsRef.current, bid];
    pendingBidsRef.current = nextPending;
    setPendingBids(nextPending);
    pendingPlayerIdRef.current = auctionState?.currentPlayerId ?? null;
    setBidAmount("");
    if (nextPending.length >= 4) {
      void flushPendingBids();
    } else {
      scheduleFlush();
    }
    void updateLiveBid(teamId, amount).catch((err) => {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to update live bid.",
      );
    });
  };

  const handleMarkSold = async () => {
    if (!auctionState?.currentPlayerId || !currentPlayer) {
      setStatusMessage("Select a player before marking sold.");
      return;
    }
    if (!leadingTeamCombined) {
      setStatusMessage("No leading team yet. Place a bid first.");
      return;
    }
    if (!currentBidAmount) {
      setStatusMessage("Bid amount must be greater than 0 to mark sold.");
      return;
    }
    if (pendingBidsRef.current.length > 0) {
      const synced = await flushPendingBids();
      if (!synced || pendingBidsRef.current.length > 0) {
        setStatusMessage("Sync pending bids before marking a player sold.");
        return;
      }
    }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await markPlayerSold();
      const nextPlayer = getRandomAvailablePlayer(
        auctionState?.currentPlayerId ?? undefined,
      );
      if (nextPlayer) {
        await setCurrentPlayer(nextPlayer.id);
        setSelectedPlayerId(nextPlayer.id);
        setBidAmount("20000"); // Pre-fill bid for next player
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

  const handleMarkUnsold = async () => {
    if (!auctionState?.currentPlayerId || !currentPlayer) {
      setStatusMessage("Select a player before marking unsold.");
      return;
    }
    if (combinedBidHistory.length > 0) {
      setStatusMessage("Cannot mark unsold after bids have been placed.");
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await markPlayerUnsold();
      const nextPlayer = getRandomAvailablePlayer(
        auctionState?.currentPlayerId ?? undefined,
      );
      if (nextPlayer) {
        await setCurrentPlayer(nextPlayer.id);
        setSelectedPlayerId(nextPlayer.id);
        setBidAmount("20000");
      } else {
        setSelectedPlayerId("");
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to mark player unsold.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const normalizeDifference = (value: string) => {
    const numericValue = Number(value) || 0;
    const rounded = Math.round(numericValue / 1000) * 1000;
    return String(Math.max(2000, rounded));
  };

  const canMarkSold =
    auctionLive &&
    !submitting &&
    Boolean(currentPlayer) &&
    Boolean(leadingTeamCombined) &&
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
                  {currentPlayer
                    ? `${currentPlayer.name} · ${currentPlayer.role}`
                    : selectedPlayer
                      ? `${selectedPlayer.name} · ${selectedPlayer.role}`
                      : "Select an available player"}
                </Button>
                <Button
                  type="button"
                  onClick={handleStartAuction}
                  disabled={auctionLive || submitting}
                >
                  Start auction
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRandomPlayer}
                  disabled={auctionLive || submitting}
                >
                  Random player
                </Button>
                {auctionLive ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleStopAuction}
                    disabled={submitting}
                  >
                    <Repeat className="text-destructive" />
                  </Button>
                ) : null}
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
                          void handleSelectPlayer(player.id);
                          setPlayerCommandOpen(false);
                        }}
                      >
                        <span className="font-medium capitalize">
                          {player.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {player.role}
                        </span>
                        {player.status === "UNSOLD" ? (
                          <Badge variant="outline">Unsold</Badge>
                        ) : null}
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
                primary={formatAmount(currentBidAmount)}
                secondary={`Leading team: ${
                  leadingTeamCombined
                    ? formatTeamLabel(leadingTeamCombined)
                    : "None"
                }`}
              />
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bid-amount">Bid amount</Label>
                  <Input
                    id="bid-amount"
                    type="number"
                    min={minBid}
                    step={1000}
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    disabled={!auctionLive || submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: {formatAmount(minBid)}
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="bid-diff">Bid difference</Label>
                    <Input
                      id="bid-diff"
                      type="number"
                      min={2000}
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
                  <div className="flex flex-wrap items-end gap-2">
                    {[5000, 10000].map((value) => (
                      <Button
                        key={`diff-${value}`}
                        type="button"
                        variant="outline"
                        onClick={() => setDifferenceAmount(String(value))}
                        disabled={
                          !auctionLive ||
                          submitting ||
                          (forceDiff10000 && value !== 10000)
                        }
                      >
                        {formatAmount(value)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bid team</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {teamStats.map((team) => {
                    const maxBid = getMaxBidForTeam(team);
                    const disabled =
                      !auctionLive ||
                      // submitting ||
                      Number(bidAmount) > maxBid ||
                      team.id === lastBidTeamId ||
                      maxBid <= 0;
                    return (
                      <Button
                        key={team.id}
                        type="button"
                        variant="outline"
                        className="h-auto justify-between py-2 text-left flex-col gap-0.5"
                        disabled={disabled}
                        onClick={() => void placeBidForTeam(team.id)}
                      >
                        <span className="text-xs font-semibold">
                          {team.captainName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Max {formatAmount(Math.max(0, maxBid))}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end py-2">
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
                          {leadingTeamCombined
                            ? formatTeamLabel(leadingTeamCombined)
                            : "-"}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMarkUnsold}
                  disabled={
                    !auctionLive || submitting || combinedBidHistory.length > 0
                  }
                >
                  Mark UNSOLD
                </Button>
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
                    {leadingTeamCombined
                      ? formatTeamLabel(leadingTeamCombined)
                      : "-"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Final price:{" "}
                  <span className="font-medium text-foreground">
                    {formatAmount(currentBidAmount)}
                  </span>
                </p>
              </div>
            </div>

            {statusMessage ? (
              <p className="text-sm text-destructive">{statusMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bid History</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-6rem)] overflow-y-auto">
            {combinedBidHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bids yet. Bids will appear live here.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingBids.length > 0 ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <span>
                      {pendingBids.length} pending{" "}
                      {pendingBids.length === 1 ? "bid" : "bids"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void flushPendingBids()}
                      disabled={syncingBids}
                    >
                      {syncingBids ? "Syncing..." : "Sync now"}
                    </Button>
                  </div>
                ) : null}
                {[...combinedBidHistory].reverse().map((bid, index) => {
                  const originalIndex = combinedBidHistory.length - 1 - index;
                  const isPending = originalIndex >= bidHistory.length;
                  return (
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
                            playersCount: 0,
                            maxBidAmount: 0,
                          },
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : null}
                        <span className="font-semibold">
                          {formatAmount(bid.amount)}
                        </span>
                        {!isPending ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => handleDeleteBid(originalIndex)}
                            disabled={submitting}
                            aria-label="Delete bid"
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
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
                  name={formatTeamLabel(team, true)}
                  captain={team.captainName}
                  spent={formatAmount(team.spentAmount)}
                  remaining={formatAmount(team.remainingPurse)}
                  playersCount={team.playersCount}
                  teamSize={tournament?.teamSize ?? 9}
                  onClick={() => navigate(`/auction/teams/${team.id}`)}
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
