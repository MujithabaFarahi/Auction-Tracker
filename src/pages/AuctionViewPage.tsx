import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type CompletedSort = "timeDesc" | "timeAsc" | "priceDesc" | "priceAsc";
type PlayersSort = "nameAsc" | "nameDesc" | "baseAsc" | "baseDesc";

function AuctionViewPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [completedSort, setCompletedSort] = useState<CompletedSort>("timeDesc");
  const [playersSort, setPlayersSort] = useState<PlayersSort>("nameAsc");
  const [playersRole, setPlayersRole] = useState<string>("all");
  const [playerSearch, setPlayerSearch] = useState("");

  const navigate = useNavigate();

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

  const soldPlayers = useMemo(
    () => players.filter((player) => player.status === "SOLD"),
    [players],
  );

  const sortedCompletedPlayers = useMemo(() => {
    const data = [...soldPlayers];
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
  }, [soldPlayers, completedSort]);

  const lastCompletedPlayer = sortedCompletedPlayers[0] ?? null;

  const unsoldPlayers = useMemo(
    () => players.filter((player) => player.status === "AVAILABLE"),
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
    switch (playersSort) {
      case "baseAsc":
        return sorted.sort((a, b) => a.basePrice - b.basePrice);
      case "baseDesc":
        return sorted.sort((a, b) => b.basePrice - a.basePrice);
      case "nameDesc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case "nameAsc":
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [unsoldPlayers, playerSearch, playersSort, playersRole]);

  const teamStats = useMemo(() => {
    const counts: Record<string, number> = {};
    soldPlayers.forEach((player) => {
      if (player.soldToTeamId) {
        counts[player.soldToTeamId] = (counts[player.soldToTeamId] ?? 0) + 1;
      }
    });
    return teams.map((team) => ({
      ...team,
      spent: team.spentAmount ?? team.totalPurse - team.remainingPurse,
      playersCount: counts[team.id] ?? 0,
    }));
  }, [teams, soldPlayers]);

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
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

        <Tabs defaultValue="live">
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
              <Card>
                <CardHeader>
                  <CardTitle>Live Auction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        Current player
                      </p>
                      <p className="text-base font-semibold">
                        {currentPlayer
                          ? currentPlayer.name
                          : "Awaiting selection"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentPlayer ? currentPlayer.role : "Not started"}
                      </p>
                      <p className="text-sm">
                        Base price:{" "}
                        <span className="font-medium">
                          {currentPlayer
                            ? formatAmount(currentPlayer.basePrice)
                            : "-"}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        Current bid
                      </p>
                      <p className="text-2xl font-semibold">
                        {formatAmount(auctionState?.currentBid ?? 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Leading team:{" "}
                        {leadingTeam ? formatTeamLabel(leadingTeam) : "None"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">Bid history</h3>
                    <div className="mt-2 space-y-2">
                      {auctionState?.bidHistory?.length ? (
                        auctionState.bidHistory.map((bid, index) => (
                          <div
                            key={`${bid.teamId}-${bid.timestamp}-${index}`}
                            className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                          >
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
                                },
                              )}
                            </span>
                            <span className="font-semibold">
                              {formatAmount(bid.amount)}
                            </span>
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

              <Card>
                <CardHeader>
                  <CardTitle>Last Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  {lastCompletedPlayer ? (
                    <div className="space-y-2">
                      <div className="rounded-md border bg-background p-3">
                        <p className="text-base font-semibold">
                          {lastCompletedPlayer.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lastCompletedPlayer.role}
                        </p>
                        <p className="text-sm">
                          Sold for{" "}
                          <span className="font-semibold">
                            {formatAmount(lastCompletedPlayer.soldPrice ?? 0)}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Team:{" "}
                          {formatTeamLabel(
                            teams.find(
                              (team) =>
                                team.id === lastCompletedPlayer.soldToTeamId,
                            ) ?? null,
                          )}
                        </p>
                      </div>
                      <Link
                        to={`/auction/players/${lastCompletedPlayer.id}`}
                        className="text-sm font-medium text-primary"
                      >
                        View player details
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No completed players yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Completed Players</CardTitle>
                <div className="flex items-center gap-2 text-sm mt-2 w-full sm:w-auto">
                  <Select
                    value={completedSort}
                    onValueChange={(value) =>
                      setCompletedSort(value as CompletedSort)
                    }
                  >
                    <SelectTrigger className="h-8 w-full sm:max-w-48">
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
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border bg-background/70">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow className="hover:bg-muted/60">
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Player
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Team
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Price
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCompletedPlayers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No completed players yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedCompletedPlayers.map((player) => {
                          const team = teams.find(
                            (item) => item.id === player.soldToTeamId,
                          );
                          return (
                            <TableRow
                              key={player.id}
                              className="hover:bg-muted/30"
                            >
                              <TableCell className="py-3">
                                <Link
                                  className="text-sm font-medium text-primary"
                                  to={`/auction/players/${player.id}`}
                                >
                                  {player.name}
                                </Link>
                              </TableCell>
                              <TableCell className="py-3">
                                {team ? (
                                  <Link
                                    className="text-sm text-primary"
                                    to={`/auction/teams/${team.id}`}
                                  >
                                    {formatTeamLabel(team)}
                                  </Link>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-right font-medium">
                                {player.soldPrice ? (
                                  formatAmount(player.soldPrice)
                                ) : (
                                  <Badge variant={"outline"}>Drafted</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="sm:min-w-48">Available Players</CardTitle>
                <div className="flex flex-col sm:items-center gap-2 text-sm sm:flex-row w-full sm:justify-end">
                  <Input
                    className="h-8 w-full sm:max-w-48"
                    placeholder="Search player"
                    value={playerSearch}
                    onChange={(event) => setPlayerSearch(event.target.value)}
                  />
                  <Select
                    value={playersRole}
                    onValueChange={(value) => setPlayersRole(value)}
                  >
                    <SelectTrigger className="h-8 w-full sm:max-w-48">
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
                    <SelectTrigger className="h-8 w-full sm:max-w-48">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nameAsc">Name (A-Z)</SelectItem>
                      <SelectItem value="nameDesc">Name (Z-A)</SelectItem>
                      <SelectItem value="baseAsc">
                        Base price (low to high)
                      </SelectItem>
                      <SelectItem value="baseDesc">
                        Base price (high to low)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border bg-background/70">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow className="hover:bg-muted/60">
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Player
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Role
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Base price
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlayers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No unsold players found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPlayers.map((player) => (
                          <TableRow
                            key={player.id}
                            className="hover:bg-muted/30"
                          >
                            <TableCell className="py-3">
                              <Link
                                className="text-sm font-medium text-primary"
                                to={`/auction/players/${player.id}`}
                              >
                                {player.name}
                              </Link>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge variant="secondary">{player.role}</Badge>
                            </TableCell>
                            <TableCell className="py-3 text-right font-medium">
                              {formatAmount(player.basePrice)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border bg-background/70">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow className="hover:bg-muted/60">
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Team
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Spent
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Remaining
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Players
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamStats.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No teams created yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        teamStats.map((team) => (
                          <TableRow key={team.id} className="hover:bg-muted/30">
                            <TableCell className="py-3">
                              <Link
                                className="text-sm font-medium text-primary"
                                to={`/auction/teams/${team.id}`}
                              >
                                {formatTeamLabel(team)}
                              </Link>
                            </TableCell>
                            <TableCell className="py-3 text-right font-medium">
                              {formatAmount(team.spent)}
                            </TableCell>
                            <TableCell className="py-3 text-right font-medium">
                              {formatAmount(team.remainingPurse)}
                            </TableCell>
                            <TableCell className="py-3 text-right font-medium">
                              {team.playersCount}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default AuctionViewPage;
