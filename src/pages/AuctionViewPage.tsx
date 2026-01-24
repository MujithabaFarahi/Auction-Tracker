import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAmount, formatTeamLabel } from "@/lib/format";
import {
  auctionStateDocRef,
  playersCollectionRef,
  teamsCollectionRef,
  tournamentDocRef,
  PLAYER_ROLES,
  type AuctionState,
  type Player,
  type Team,
  type Tournament,
} from "@/lib/firestore";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LiveInfoCard } from "@/components/auction/LiveInfoCard";
import { PlayerCard } from "@/components/auction/PlayerCard";
import { PlayerTile } from "@/components/auction/PlayerTile";
import { TeamCard } from "@/components/auction/TeamCard";
import { toast } from "sonner";

type CompletedSort = "timeDesc" | "timeAsc" | "priceDesc" | "priceAsc";
type PlayersSort =
  | "createdDesc"
  | "createdAsc"
  | "nameAsc"
  | "nameDesc"
  | "baseAsc"
  | "baseDesc";

function AuctionViewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [completedSort, setCompletedSort] = useState<CompletedSort>("timeDesc");
  const [playersSort, setPlayersSort] = useState<PlayersSort>("createdAsc");
  const [playersRole, setPlayersRole] = useState<string>("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const soldToastInitializedRef = useRef(false);
  const seenSoldIdsRef = useRef<Set<string>>(new Set());

  const navigate = useNavigate();

  const activeTab = searchParams.get("tab") ?? "live";
  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  const { user } = useAuth();

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

  const currentPlayer = useMemo(
    () =>
      players.find((player) => player.id === auctionState?.currentPlayerId) ??
      null,
    [players, auctionState?.currentPlayerId],
  );

  const leadingTeam = useMemo(
    () => teams.find((team) => team.id === auctionState?.leadingTeamId) ?? null,
    [teams, auctionState?.leadingTeamId],
  );

  const completedPlayers = useMemo(
    () => players.filter((player) => player.status !== "AVAILABLE"),
    [players],
  );

  useEffect(() => {
    if (players.length === 0) {
      return;
    }
    if (!soldToastInitializedRef.current) {
      seenSoldIdsRef.current = new Set(
        players
          .filter(
            (player) => player.status === "SOLD" || player.status === "DRAFTED",
          )
          .map((player) => player.id),
      );
      soldToastInitializedRef.current = true;
      return;
    }
    const newSoldPlayers = players.filter(
      (player) =>
        (player.status === "SOLD" || player.status === "DRAFTED") &&
        !seenSoldIdsRef.current.has(player.id),
    );
    if (newSoldPlayers.length === 0) {
      return;
    }
    newSoldPlayers.forEach((player) => {
      const team =
        teams.find((item) => item.id === player.soldToTeamId) ?? null;
      const priceLabel =
        typeof player.soldPrice === "number"
          ? formatAmount(player.soldPrice)
          : "Drafted";
      toast.success(
        `${player.name} ${player.status === "DRAFTED" ? "Drafted" : "Sold"}`,
        {
          description: `${team ? formatTeamLabel(team, true) : "Team"} • ${priceLabel}`,
        },
      );
      seenSoldIdsRef.current.add(player.id);
    });
  }, [players, teams]);

  const sortedCompletedPlayers = useMemo(() => {
    const data = [...completedPlayers];
    switch (completedSort) {
      case "priceAsc":
        return data.sort((a, b) => (a.soldPrice ?? 0) - (b.soldPrice ?? 0));
      case "priceDesc":
        return data.sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
      case "timeAsc":
        return data.sort((a, b) => (a.soldAt ?? 0) - (b.soldAt ?? 0));
      case "timeDesc":
      default:
        return data.sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0));
    }
  }, [completedPlayers, completedSort]);

  const lastCompletedPlayer = sortedCompletedPlayers[0] ?? null;

  const unsoldPlayers = useMemo(
    () =>
      players.filter(
        (player) => player.status === "AVAILABLE" || player.status === "UNSOLD",
      ),
    [players],
  );

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    const filteredByRole =
      playersRole === "all"
        ? unsoldPlayers
        : unsoldPlayers.filter((player) => player.role === playersRole);
    const filtered = query
      ? filteredByRole.filter((player) =>
          player.name.toLowerCase().includes(query),
        )
      : filteredByRole;
    const sorted = [...filtered];
    const statusRank = (status: Player["status"]) =>
      status === "UNSOLD" ? 1 : 0;
    const compareBySort = (a: Player, b: Player) => {
      switch (playersSort) {
        case "createdAsc":
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        case "createdDesc":
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        case "baseAsc":
          return a.basePrice - b.basePrice;
        case "baseDesc":
          return b.basePrice - a.basePrice;
        case "nameDesc":
          return b.name.localeCompare(a.name);
        case "nameAsc":
        default:
          return a.name.localeCompare(b.name);
      }
    };
    return sorted.sort((a, b) => {
      const rankDiff = statusRank(a.status) - statusRank(b.status);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return compareBySort(a, b);
    });
  }, [unsoldPlayers, playerSearch, playersSort, playersRole]);

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
      spent: team.spentAmount ?? team.totalPurse - team.remainingPurse,
      playersCount: counts[team.id] ?? 0,
    }));
  }, [teams, players]);

  return (
    <div className="min-h-svh bg-muted/30 flex flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full">
            <h1 className="text-2xl font-semibold">
              {tournament?.name ?? "Auction Tracker"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tournament?.season ?? "Live auction view"}
            </p>
          </div>
          <div className="flex w-full justify-between items-center sm:w-auto gap-4">
            {user ? (
              <Button onClick={() => navigate("/admin/auction")}>Admin</Button>
            ) : auctionState ? (
              <Badge>{auctionState.status}</Badge>
            ) : null}
            <ThemeToggle />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-4 sm:flex">
            <TabsTrigger className="cursor-pointer px-4" value="live">
              Live
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer px-4" value="completed">
              Completed
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer px-4" value="players">
              Players
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer px-4" value="teams">
              Teams
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card className="gap-2">
                <CardHeader>
                  <CardTitle>Live Auction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <LiveInfoCard
                      title="Current player"
                      primary={
                        currentPlayer
                          ? currentPlayer.name
                          : "Awaiting selection"
                      }
                      secondary={
                        currentPlayer ? currentPlayer.role : "Not started"
                      }
                      meta={
                        <>
                          <p>
                            Base price:{" "}
                            <span className="font-medium">
                              {currentPlayer ? formatAmount(20000) : "-"}
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
                        </>
                      }
                    />
                    <LiveInfoCard
                      title="Current bid"
                      primary={formatAmount(auctionState?.currentBid ?? 0)}
                      secondary={`Leading team: ${
                        leadingTeam
                          ? formatTeamLabel(leadingTeam, true)
                          : "None"
                      }`}
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Bid history</h3>
                    <div className="max-h-96 overflow-y-auto">
                      {auctionState?.bidHistory?.length ? (
                        [...auctionState.bidHistory]
                          .reverse()
                          .map((bid, index) => (
                            <div
                              key={`${bid.teamId}-${bid.timestamp}-${index}`}
                              className="mt-0.5"
                            >
                              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                <span>
                                  {formatTeamLabel(
                                    teams.find(
                                      (team) => team.id === bid.teamId,
                                    ) ?? {
                                      id: bid.teamId,
                                      name: bid.teamName,
                                      captainName: "",
                                      totalPurse: 0,
                                      remainingPurse: 0,
                                      spentAmount: 0,
                                      playersCount: 0,
                                      maxBidAmount: 0,
                                    },
                                    true,
                                  )}
                                </span>
                                <span className="font-semibold">
                                  {formatAmount(bid.amount)}
                                </span>
                              </div>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No bids yet. Updates appear live.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="gap-2">
                  <CardHeader>
                    <CardTitle>Max bids</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 grid-cols-2">
                      {teamStats.map((team) => {
                        const teamSize = tournament?.teamSize ?? 9;
                        const remainingSlots = Math.max(
                          0,
                          teamSize - (team.playersCount ?? 0),
                        );
                        const fallbackMax =
                          remainingSlots > 0
                            ? team.remainingPurse - (remainingSlots - 1) * 20000
                            : 0;
                        const maxBid = team.maxBidAmount ?? fallbackMax;
                        return (
                          <div
                            key={team.id}
                            className="rounded-md border bg-background px-3 py-2 text-xs"
                          >
                            <p className="font-medium">
                              {formatTeamLabel(team, true)}
                            </p>
                            <p className="text-muted-foreground">
                              Max:{" "}
                              <span className="font-semibold text-foreground">
                                {formatAmount(Math.max(0, maxBid))}
                              </span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="gap-2">
                  <CardHeader>
                    <CardTitle>Last Completed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lastCompletedPlayer ? (
                      <div className="space-y-2">
                        {(() => {
                          const team = teams.find(
                            (item) =>
                              item.id === lastCompletedPlayer.soldToTeamId,
                          );
                          const isUnsold =
                            lastCompletedPlayer.status === "UNSOLD";
                          const isDrafted =
                            lastCompletedPlayer.status === "DRAFTED";
                          return (
                            <PlayerCard
                              name={lastCompletedPlayer.name}
                              role={lastCompletedPlayer.role}
                              badge={
                                isUnsold
                                  ? "Unsold"
                                  : isDrafted
                                    ? "Drafted"
                                    : "Sold"
                              }
                              teamLabel={
                                !isUnsold && team
                                  ? formatTeamLabel(team, true)
                                  : undefined
                              }
                              basePrice={formatAmount(
                                lastCompletedPlayer.basePrice,
                              )}
                              finalPrice={
                                isUnsold
                                  ? "-"
                                  : isDrafted
                                    ? "Drafted"
                                    : lastCompletedPlayer.soldPrice
                                      ? formatAmount(
                                          lastCompletedPlayer.soldPrice,
                                        )
                                      : "-"
                              }
                              onClick={() =>
                                navigate(
                                  `/auction/players/${lastCompletedPlayer.id}`,
                                )
                              }
                              onTeamClick={(event) => {
                                if (!team || isUnsold) {
                                  return;
                                }
                                event.stopPropagation();
                                navigate(`/auction/teams/${team.id}`);
                              }}
                            />
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No completed players yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Completed Players</CardTitle>
              <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
                <Select
                  value={completedSort}
                  onValueChange={(value) =>
                    setCompletedSort(value as CompletedSort)
                  }
                >
                  <SelectTrigger className="h-10 w-full sm:max-w-48">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timeDesc">Time (newest)</SelectItem>
                    <SelectItem value="timeAsc">Time (oldest)</SelectItem>
                    <SelectItem value="priceDesc">
                      Price (high to low)
                    </SelectItem>
                    <SelectItem value="priceAsc">
                      Price (low to high)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {sortedCompletedPlayers.length === 0 ? (
              <div className="rounded-lg border bg-background/70 py-6 text-center text-muted-foreground">
                No completed players yet.
              </div>
            ) : (
              <div className="grid gap-1.5 md:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedCompletedPlayers.map((player) => {
                  const isUnsold = player.status === "UNSOLD";
                  const isDrafted = player.status === "DRAFTED";
                  const team = teams.find(
                    (item) => item.id === player.soldToTeamId,
                  );
                  return (
                    <PlayerCard
                      key={player.id}
                      name={player.name}
                      role={player.role}
                      badge={
                        isUnsold ? "Unsold" : isDrafted ? "Drafted" : "Sold"
                      }
                      teamLabel={
                        !isUnsold && team
                          ? formatTeamLabel(team, true)
                          : undefined
                      }
                      basePrice={formatAmount(player.basePrice)}
                      finalPrice={
                        isUnsold
                          ? "-"
                          : isDrafted
                            ? "Drafted"
                            : player.soldPrice
                              ? formatAmount(player.soldPrice)
                              : undefined
                      }
                      onClick={() => navigate(`/auction/players/${player.id}`)}
                      onTeamClick={(event) => {
                        if (!team || isUnsold) {
                          return;
                        }
                        event.stopPropagation();
                        navigate(`/auction/teams/${team.id}`);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="players" className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="sm:min-w-48">Available Players</CardTitle>
              <div className="flex flex-col sm:items-center gap-1.5 sm:gap-2 text-sm sm:flex-row w-full sm:justify-end">
                <Input
                  className="h-10 w-full sm:max-w-48"
                  placeholder="Search player"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                />
                <Select
                  value={playersRole}
                  onValueChange={(value) => setPlayersRole(value)}
                >
                  <SelectTrigger className="h-10 w-full sm:max-w-48">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {PLAYER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={playersSort}
                  onValueChange={(value) =>
                    setPlayersSort(value as PlayersSort)
                  }
                >
                  <SelectTrigger className="h-10 w-full sm:max-w-48">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nameAsc">Name (A-Z)</SelectItem>
                    <SelectItem value="nameDesc">Name (Z-A)</SelectItem>
                    <SelectItem value="createdDesc">Added (newest)</SelectItem>
                    <SelectItem value="createdAsc">Added (oldest)</SelectItem>
                    <SelectItem value="baseAsc">
                      Base price (low to high)
                    </SelectItem>
                    <SelectItem value="baseDesc">
                      Base price (high to low)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filteredPlayers.length === 0 ? (
              <div className="rounded-lg border bg-background/70 py-6 text-center text-muted-foreground">
                No unsold players found.
              </div>
            ) : (
              <div className="grid gap-1.5 md:gap-3 sm:grid-cols-2 md:grid-cols-3">
                {filteredPlayers.map((player) => (
                  <PlayerTile
                    key={player.id}
                    name={player.name}
                    role={player.role}
                    basePrice={formatAmount(player.basePrice)}
                    onClick={() => navigate(`/auction/players/${player.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <CardTitle>Teams</CardTitle>
            {teamStats.length === 0 ? (
              <div className="rounded-lg border bg-background/70 py-6 text-center text-muted-foreground">
                No teams created yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {teamStats.map((team) => (
                  <TeamCard
                    key={team.id}
                    name={formatTeamLabel(team, true)}
                    captain={team.captainName}
                    spent={formatAmount(team.spent)}
                    remaining={formatAmount(team.remainingPurse)}
                    playersCount={team.playersCount}
                    teamSize={tournament?.teamSize ?? 9}
                    onClick={() => navigate(`/auction/teams/${team.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground">
        © 2025{" "}
        <a
          href="https://teqgrow.com/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline underline-offset-4"
        >
          TeqGrow
        </a>
        . All rights reserved.
      </footer>
    </div>
  );
}

export default AuctionViewPage;
