import { useEffect, useMemo, useState } from "react";
import { onSnapshot, writeBatch } from "firebase/firestore";

import { PlayerPhoto } from "@/components/auction/PlayerPhoto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount, formatTeamLabel } from "@/lib/format";
import {
  PLAYER_ROLES,
  completeTournament,
  configDocRef,
  createTournament,
  deletePlayer,
  ensureAuctionState,
  ensureGlobalConfig,
  getAuctionStateDocRef,
  getPlayersCollectionRef,
  getPlayerContact,
  getTeamDocRef,
  getTeamsCollectionRef,
  getTournamentDocRef,
  savePlayer,
  saveTeam,
  setActiveTournament,
  tournamentsCollectionRef,
  updatePlayer,
  updateTournament,
  type AuctionState,
  type Player,
  type PlayerRole,
  type Team,
  type Tournament,
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import playerPoolRaw from "../../../playerpool.txt?raw";
import { useNavigate } from "react-router-dom";

const PLAYER_AREAS = ["Nangalla", "Mangedara", "Majeedpura"] as const;
const ROLE_ALIASES: Record<string, (typeof PLAYER_ROLES)[number]> = {
  batsman: "Batsman",
  "wicket-keeper batsman": "Wicket-keeper Batsman",
  "wicket keeper batsman": "Wicket-keeper Batsman",
  "fast bowler": "Fast Bowler",
  "spin bowler": "Spin Bowler",
  "all-rounder (pace)": "All-Rounder (Pace)",
  "all rounder (pace)": "All-Rounder (Pace)",
  "allrounder (pace)": "All-Rounder (Pace)",
  "all-rounder (spin)": "All-Rounder (Spin)",
  "all rounder (spin)": "All-Rounder (Spin)",
  "allrounder (spin)": "All-Rounder (Spin)",
};

type TeamFormState = {
  name: string;
  captainName: string;
};

type PlayerFormState = {
  name: string;
  contactNumber: string;
  area: string;
  role: PlayerRole;
  basePrice: string;
  regularTeam: string;
  imageUrl: string;
  assignToTeam: boolean;
  teamId: string;
  assignmentPrice: string;
};

type TournamentFormState = {
  name: string;
  season: string;
  teamPurse: string;
  teamSize: string;
};

const emptyTeamForm: TeamFormState = {
  name: "",
  captainName: "",
};

const emptyPlayerForm: PlayerFormState = {
  name: "",
  contactNumber: "",
  area: "",
  role: PLAYER_ROLES[0],
  basePrice: "",
  regularTeam: "",
  imageUrl: "",
  assignToTeam: false,
  teamId: "",
  assignmentPrice: "",
};

const emptyTournamentForm: TournamentFormState = {
  name: "",
  season: "",
  teamPurse: "",
  teamSize: "9",
};

function SetupPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<
    string | null
  >(null);
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(
    null,
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teamForm, setTeamForm] = useState<TeamFormState>(emptyTeamForm);
  const [playerForm, setPlayerForm] =
    useState<PlayerFormState>(emptyPlayerForm);
  const [tournamentForm, setTournamentForm] =
    useState<TournamentFormState>(emptyTournamentForm);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    void ensureGlobalConfig();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : null;
      setActiveTournamentId(data?.activeTournamentId ?? null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(tournamentsCollectionRef, (snapshot) => {
      const data = snapshot.docs
        .map((docSnap) => docSnap.data())
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setTournaments(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isCreatingTournament) {
      return;
    }
    if (
      selectedTournamentId &&
      tournaments.some((item) => item.id === selectedTournamentId)
    ) {
      return;
    }
    setSelectedTournamentId(activeTournamentId ?? tournaments[0]?.id ?? null);
  }, [activeTournamentId, isCreatingTournament, selectedTournamentId, tournaments]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setTournament(null);
      setTeams([]);
      setPlayers([]);
      setAuctionState(null);
      setTournamentForm(emptyTournamentForm);
      return;
    }

    void ensureAuctionState(selectedTournamentId);

    const tournamentUnsubscribe = onSnapshot(
      getTournamentDocRef(selectedTournamentId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setTournament(null);
          setTournamentForm(emptyTournamentForm);
          return;
        }
        const data = snapshot.data();
        setTournament(data);
        setIsCreatingTournament(false);
        setTournamentForm({
          name: data.name ?? "",
          season: data.season ?? "",
          teamPurse:
            typeof data.teamPurse === "number" ? String(data.teamPurse) : "",
          teamSize:
            typeof data.teamSize === "number" ? String(data.teamSize) : "9",
        });
      },
    );

    const teamsUnsubscribe = onSnapshot(
      getTeamsCollectionRef(selectedTournamentId),
      (snapshot) => {
        setTeams(snapshot.docs.map((docSnap) => docSnap.data()));
      },
    );

    const playersUnsubscribe = onSnapshot(
      getPlayersCollectionRef(selectedTournamentId),
      (snapshot) => {
        setPlayers(snapshot.docs.map((docSnap) => docSnap.data()));
      },
    );

    const auctionUnsubscribe = onSnapshot(
      getAuctionStateDocRef(selectedTournamentId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setAuctionState(null);
          return;
        }
        setAuctionState(snapshot.data());
      },
    );

    return () => {
      tournamentUnsubscribe();
      teamsUnsubscribe();
      playersUnsubscribe();
      auctionUnsubscribe();
    };
  }, [selectedTournamentId]);

  const auctionLive = auctionState?.status === "LIVE";
  const activeTournament = useMemo(
    () =>
      tournaments.find((item) => item.id === activeTournamentId) ??
      (tournament?.id === activeTournamentId ? tournament : null),
    [activeTournamentId, tournament, tournaments],
  );

  const canEditPlayer = () => true;
  const canDeletePlayer = (player: Player) =>
    auctionState?.currentPlayerId !== player.id;
  const editedPlayer = players.find((player) => player.id === editingPlayerId);
  const canAssignPlayer =
    !editingPlayerId ||
    (editedPlayer &&
      !editedPlayer.soldToTeamId &&
      (editedPlayer.status === "AVAILABLE" || editedPlayer.status === "UNSOLD") &&
      auctionState?.currentPlayerId !== editingPlayerId);

  const requireSelectedTournament = () => {
    if (!selectedTournamentId) {
      setError("Create or select a tournament first.");
      return null;
    }
    return selectedTournamentId;
  };

  const handleTeamSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const tournamentId = requireSelectedTournament();
    if (!tournamentId) {
      return;
    }

    const totalPurse = Number(tournament?.teamPurse ?? 0);
    if (!teamForm.name || !teamForm.captainName || totalPurse <= 0) {
      setError("Team name, captain, and tournament purse are required.");
      return;
    }

    setSaving(true);
    try {
      await saveTeam(tournamentId, {
        name: teamForm.name,
        captainName: teamForm.captainName,
        totalPurse,
      });
      setTeamForm(emptyTeamForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save team.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetTeams = async () => {
    const tournamentId = requireSelectedTournament();
    if (!tournamentId) {
      return;
    }
    if (teams.length === 0) {
      setError("No teams to reset.");
      return;
    }
    const confirmation = window.confirm(
      "Reset all teams to total/remaining 500000, spent 0, players 0, max bid 380000?",
    );
    if (!confirmation) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      teams.forEach((team) => {
        batch.update(getTeamDocRef(tournamentId, team.id), {
          totalPurse: 500000,
          remainingPurse: 500000,
          spentAmount: 0,
          playersCount: 0,
          maxBidAmount: 380000,
        });
      });
      await batch.commit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset teams.");
    } finally {
      setSaving(false);
    }
  };

  const handlePlayerSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);

    const tournamentId = requireSelectedTournament();
    if (!tournamentId) {
      return;
    }

    const basePrice = Number(playerForm.basePrice || 0);
    if (!playerForm.name || Number.isNaN(basePrice) || basePrice < 0) {
      setError("Player name is required and base price must be 0 or more.");
      return;
    }
    const assignment = playerForm.assignToTeam
      ? { teamId: playerForm.teamId, price: Number(playerForm.assignmentPrice || 0) }
      : undefined;
    if (assignment && !assignment.teamId) {
      setError("Select a team to assign this player.");
      return;
    }
    if (assignment && (!Number.isSafeInteger(assignment.price) || assignment.price < 0)) {
      setError("Enter a whole assignment price of 0 or more.");
      return;
    }

    const imageUrl = playerForm.imageUrl.trim() || null;
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      setError("Enter an image link that starts with https:// or http://.");
      return;
    }

    setSaving(true);
    try {
      const details = {
        name: playerForm.name,
        contactNumber: playerForm.contactNumber,
        area: playerForm.area,
        role: playerForm.role,
        basePrice,
        regularTeam: playerForm.regularTeam,
        imageUrl,
      };
      if (editingPlayerId) {
        await updatePlayer(tournamentId, editingPlayerId, details, assignment);
      } else {
        await savePlayer(tournamentId, details, assignment);
      }
      setPlayerForm(emptyPlayerForm);
      setEditingPlayerId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save player.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlayer = async (player: Player) => {
    const tournamentId = requireSelectedTournament();
    if (!tournamentId) return;
    setSaving(true);
    setError(null);
    try {
      const contactNumber = await getPlayerContact(tournamentId, player.id, player.contactNumber);
      setEditingPlayerId(player.id);
      setPlayerForm({
        ...emptyPlayerForm,
        name: player.name,
        contactNumber,
        area: player.area ?? "",
        role: player.role,
        basePrice: String(player.basePrice),
        regularTeam: player.regularTeam ?? "",
        imageUrl: player.imageUrl ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load player details.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    const tournamentId = requireSelectedTournament();
    if (!tournamentId) {
      return;
    }
    const confirmation = window.confirm(
      `Delete ${player.name}?${player.status === "SOLD" ? " This will refund the team purse." : ""}`,
    );
    if (!confirmation) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deletePlayer(tournamentId, player.id);
      if (editingPlayerId === player.id) {
        setEditingPlayerId(null);
        setPlayerForm(emptyPlayerForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete player.");
    } finally {
      setSaving(false);
    }
  };

  const handleTournamentSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    const teamPurse = Number(tournamentForm.teamPurse || 0);
    const teamSize = Number(tournamentForm.teamSize || 0);
    if (Number.isNaN(teamPurse) || teamPurse < 0) {
      setError("Team purse must be 0 or more.");
      return;
    }
    if (Number.isNaN(teamSize) || teamSize <= 0) {
      setError("Team size must be at least 1.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: tournamentForm.name.trim() || "Softball Auction",
        season: tournamentForm.season.trim() || "2025",
        teamPurse,
        teamSize,
        status:
          selectedTournamentId && activeTournamentId === selectedTournamentId
            ? "LIVE"
            : tournament?.status ?? "PENDING",
      } as const;

      if (selectedTournamentId) {
        await updateTournament(selectedTournamentId, payload);
        setIsCreatingTournament(false);
      } else {
        const nextTournamentId = await createTournament(payload);
        setIsCreatingTournament(false);
        setSelectedTournamentId(nextTournamentId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save tournament.",
      );
    } finally {
      setSaving(false);
    }
  };

  const tournamentSummary = useMemo(() => {
    if (!tournament) {
      return "Create a tournament to start adding teams and players.";
    }
    return `${tournament.name} · ${tournament.season} · ${formatAmount(
      tournament.teamPurse ?? 0,
    )} per team · ${tournament.teamSize ?? 9} players`;
  }, [tournament]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [players],
  );

  const normalizeRole = (rawRole: string) => {
    const key = rawRole.trim().toLowerCase().replace(/\s+/g, " ");
    return ROLE_ALIASES[key] ?? null;
  };

  const normalizeArea = (rawArea: string) => {
    const cleaned = rawArea.trim().toLowerCase();
    const match = PLAYER_AREAS.find((area) => area.toLowerCase() === cleaned);
    return match ?? "";
  };

  const parsePlayerPool = (raw: string) => {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const rows = lines.map((line) => line.split("\t"));
    const dataRows = rows.filter((columns) => {
      const name = (columns[0] ?? "").trim().toLowerCase();
      return name && name !== "name";
    });

    return dataRows.map((columns) => {
      const getColumn = (index: number) =>
        (columns[index] ?? "").toString().trim();

      return {
        name: getColumn(0),
        contactNumber: getColumn(1),
        area: getColumn(2),
        role: getColumn(3),
        basePrice: getColumn(4),
        regularTeam: getColumn(6),
      };
    });
  };

  const handleImportPlayers = async () => {
    const tournamentId = requireSelectedTournament();
    if (!tournamentId) {
      return;
    }
    setError(null);
    setImportStatus(null);

    const rows = parsePlayerPool(playerPoolRaw);
    if (rows.length === 0) {
      setImportStatus("No rows found in player pool.");
      return;
    }

    const confirmation = window.confirm(
      `Import ${rows.length} players from playerpool.txt?`,
    );
    if (!confirmation) {
      return;
    }

    setSaving(true);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      for (const row of rows) {
        const role = normalizeRole(row.role);
        if (!row.name || !role) {
          skipped += 1;
          errors.push(
            `Skipped: ${row.name || "Unknown"} (invalid role: ${row.role})`,
          );
          continue;
        }

        const basePrice = Number((row.basePrice ?? "").replace(/[, ]+/g, ""));
        if (Number.isNaN(basePrice) || basePrice < 0) {
          skipped += 1;
          errors.push(
            `Skipped: ${row.name || "Unknown"} (invalid base price: ${row.basePrice})`,
          );
          continue;
        }

        await savePlayer(tournamentId, {
          name: row.name,
          contactNumber: row.contactNumber,
          area: normalizeArea(row.area),
          role,
          basePrice,
          regularTeam: row.regularTeam || "",
          imageUrl: null,
        });
        imported += 1;
      }

      const summary = `Imported ${imported} players${
        skipped ? `, skipped ${skipped}` : ""
      }.`;
      setImportStatus(summary);
      if (errors.length) {
        setError(errors.slice(0, 6).join(" | "));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to import players.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStartNewTournament = () => {
    setIsCreatingTournament(true);
    setSelectedTournamentId(null);
    setTournament(null);
    setAuctionState(null);
    setTeams([]);
    setPlayers([]);
    setEditingPlayerId(null);
    setTeamForm(emptyTeamForm);
    setPlayerForm(emptyPlayerForm);
    setTournamentForm(emptyTournamentForm);
    setError(null);
    setImportStatus(null);
  };

  const handleSetLiveTournament = async () => {
    const tournamentId = requireSelectedTournament();
    if (!tournamentId) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setActiveTournament(tournamentId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to set live tournament.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTournament = async () => {
    if (!tournament || !window.confirm(`Mark ${tournament.name} as completed?`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeTournament(tournament.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to mark tournament completed.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClearLiveTournament = async () => {
    setSaving(true);
    setError(null);
    try {
      await setActiveTournament(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to clear live tournament.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTournamentSubmit}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_repeat(4,auto)]">
              <div className="space-y-2">
                <Label htmlFor="tournament-select">Selected tournament</Label>
                <Select
                  value={
                    isCreatingTournament
                      ? "__new__"
                      : (selectedTournamentId ?? "__new__")
                  }
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      handleStartNewTournament();
                      return;
                    }
                    setIsCreatingTournament(false);
                    setSelectedTournamentId(value);
                    setTournament(null);
                    setTournamentForm(emptyTournamentForm);
                    setAuctionState(null);
                    setTeams([]);
                    setPlayers([]);
                    setEditingPlayerId(null);
                    setTeamForm(emptyTeamForm);
                    setPlayerForm(emptyPlayerForm);
                    setError(null);
                    setImportStatus(null);
                  }}
                  disabled={saving}
                >
                  <SelectTrigger id="tournament-select">
                    <SelectValue placeholder="Create a new tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">Create new tournament</SelectItem>
                    {tournaments.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.season}
                        {item.id === activeTournamentId
                          ? " · Live"
                          : item.status === "COMPLETED" ? " · Completed" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleStartNewTournament}
                  disabled={saving}
                >
                  New tournament
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSetLiveTournament}
                  disabled={
                    saving ||
                    !selectedTournamentId ||
                    selectedTournamentId === activeTournamentId
                  }
                >
                  {selectedTournamentId === activeTournamentId
                    ? "Live tournament"
                    : "Set as live"}
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearLiveTournament}
                  disabled={saving || !activeTournamentId}
                >
                  Clear live
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCompleteTournament}
                  disabled={saving || !tournament || auctionLive || tournament.status === "COMPLETED"}
                >
                  Mark completed
                </Button>
              </div>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {activeTournament
                ? `${activeTournament.name} · ${activeTournament.season} is marked live on the public tournament list.`
                : "No tournament is marked live."}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="tournament-name">Name</Label>
                <Input
                  id="tournament-name"
                  value={tournamentForm.name}
                  onChange={(event) =>
                    setTournamentForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournament-season">Season</Label>
                <Input
                  id="tournament-season"
                  value={tournamentForm.season}
                  onChange={(event) =>
                    setTournamentForm((prev) => ({
                      ...prev,
                      season: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournament-purse">Team purse</Label>
                <Input
                  id="tournament-purse"
                  type="number"
                  min={0}
                  value={tournamentForm.teamPurse}
                  onChange={(event) =>
                    setTournamentForm((prev) => ({
                      ...prev,
                      teamPurse: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournament-team-size">Team size</Label>
                <Input
                  id="tournament-team-size"
                  type="number"
                  min={1}
                  value={tournamentForm.teamSize}
                  onChange={(event) =>
                    setTournamentForm((prev) => ({
                      ...prev,
                      teamSize: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                type="submit"
                disabled={saving || Boolean(selectedTournamentId && tournament?.id !== selectedTournamentId)}
                isLoading={saving}
              >
                {isCreatingTournament ? "Create tournament" : "Save tournament"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {tournamentSummary}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={handleTeamSubmit}>
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={teamForm.name}
                  onChange={(event) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="captain-name">Captain name</Label>
                <Input
                  id="captain-name"
                  value={teamForm.captainName}
                  onChange={(event) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      captainName: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Team purse</Label>
                <div className="text-sm text-muted-foreground">
                  {formatAmount(tournament?.teamPurse ?? 0)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={saving || auctionLive || !selectedTournamentId}
                  isLoading={saving}
                >
                  Add team
                </Button>
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No teams created yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map((team) => (
                    <TableRow
                      key={team.id}
                      onClick={() => {
                        if (!selectedTournamentId) {
                          return;
                        }
                        navigate(
                          `/auction/tournaments/${selectedTournamentId}/teams/${team.id}`,
                        );
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell>{formatTeamLabel(team, true)}</TableCell>
                      <TableCell>{team.captainName}</TableCell>
                      <TableCell>{formatAmount(team.totalPurse)}</TableCell>
                      <TableCell>{formatAmount(team.remainingPurse)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetTeams}
                disabled={saving || teams.length === 0}
                isLoading={saving}
              >
                Reset team values
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleImportPlayers}
                disabled={saving || !selectedTournamentId}
                isLoading={saving}
              >
                Load players from list
              </Button>
              <span className="text-xs text-muted-foreground">
                Imports from playerpool.txt (TSV).
              </span>
            </div>
            {importStatus ? (
              <p className="text-sm text-muted-foreground">{importStatus}</p>
            ) : null}
            <form className="space-y-3" onSubmit={handlePlayerSubmit}>
              <div className="space-y-2">
                <Label htmlFor="player-name">Player name</Label>
                <Input
                  id="player-name"
                  value={playerForm.name}
                  onChange={(event) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-contact">Contact number</Label>
                <Input
                  id="player-contact"
                  value={playerForm.contactNumber}
                  onChange={(event) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      contactNumber: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-area">Area</Label>
                <Select
                  value={playerForm.area}
                  onValueChange={(value) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      area: value,
                    }))
                  }
                  disabled={saving}
                >
                  <SelectTrigger id="player-area">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYER_AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-role">Role</Label>
                <Select
                  value={playerForm.role}
                  onValueChange={(value) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      role: value as PlayerRole,
                    }))
                  }
                  disabled={saving || auctionLive}
                >
                  <SelectTrigger id="player-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-base">Base price</Label>
                <Input
                  id="player-base"
                  type="number"
                  min={0}
                  value={playerForm.basePrice}
                  onChange={(event) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      basePrice: event.target.value,
                    }))
                  }
                  disabled={saving || auctionLive}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-regular-team">Regular team</Label>
                <Input
                  id="player-regular-team"
                  value={playerForm.regularTeam}
                  onChange={(event) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      regularTeam: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-image-url">Image link (optional)</Label>
                <Input
                  id="player-image-url"
                  type="url"
                  placeholder="Paste a Google Drive link or image URL"
                  aria-describedby="player-image-url-help"
                  value={playerForm.imageUrl}
                  onChange={(event) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      imageUrl: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
                <p id="player-image-url-help" className="text-xs text-muted-foreground">
                  For Google Drive photos, set General access to Anyone with the link.
                </p>
              </div>
              {canAssignPlayer ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      id="player-assign-team"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      checked={playerForm.assignToTeam}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({
                          ...prev,
                          assignToTeam: event.target.checked,
                          teamId: event.target.checked ? prev.teamId : "",
                          assignmentPrice: event.target.checked ? prev.assignmentPrice : "",
                        }))
                      }
                      disabled={saving || teams.length === 0}
                    />
                    <Label htmlFor="player-assign-team">
                      Assign player to a team
                    </Label>
                  </div>
                  {playerForm.assignToTeam ? (
                    <div className="space-y-2">
                      <Label htmlFor="player-team">Team</Label>
                      <Select
                        value={playerForm.teamId}
                        onValueChange={(value) =>
                          setPlayerForm((prev) => ({
                            ...prev,
                            teamId: value,
                          }))
                        }
                        disabled={saving}
                      >
                        <SelectTrigger id="player-team">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {formatTeamLabel(team)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label htmlFor="player-assignment-price">Assignment price (optional)</Label>
                      <Input
                        id="player-assignment-price"
                        type="number"
                        min={0}
                        step={1}
                        value={playerForm.assignmentPrice}
                        onChange={(event) => setPlayerForm((prev) => ({
                          ...prev,
                          assignmentPrice: event.target.value,
                        }))}
                        disabled={saving}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank for a free assignment. A price is deducted from the team's remaining purse.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving} isLoading={saving}>
                  {editingPlayerId ? "Update player" : "Add player"}
                </Button>
                {editingPlayerId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPlayerForm(emptyPlayerForm);
                      setEditingPlayerId(null);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent className="max-h-screen overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No players added yet.
                  </TableCell>
                </TableRow>
              ) : (
                sortedPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlayerPhoto name={player.name} imageUrl={player.imageUrl} />
                        {player.name}
                      </div>
                    </TableCell>
                    <TableCell>{player.role}</TableCell>
                    <TableCell>{formatAmount(player.basePrice)}</TableCell>
                    <TableCell>{player.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canEditPlayer() || saving}
                          onClick={() => void handleEditPlayer(player)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={!canDeletePlayer(player) || saving}
                          onClick={() => handleDeletePlayer(player)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export default SetupPage;
