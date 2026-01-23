import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatTeamLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { playersCollectionRef, type Player, type Team } from "@/lib/firestore";
import { ArrowLeft } from "lucide-react";

function AuctionTeamPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [playerCommandOpen, setPlayerCommandOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    captainName: "",
    spentAmount: "",
    remainingPurse: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (!teamId) {
      return;
    }
    const teamRef = doc(db, "teams", teamId);
    const unsubscribe = onSnapshot(teamRef, (snapshot) => {
      if (!snapshot.exists()) {
        setTeam(null);
        return;
      }
      setTeam({ id: snapshot.id, ...(snapshot.data() as Omit<Team, "id">) });
    });
    return () => unsubscribe();
  }, [teamId]);

  useEffect(() => {
    if (!team) {
      return;
    }
    setEditForm({
      name: team.name ?? "",
      captainName: team.captainName ?? "",
      spentAmount: String(team.spentAmount ?? 0),
      remainingPurse: String(team.remainingPurse ?? 0),
    });
  }, [team]);

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

  const teamPlayers = useMemo(() => {
    if (!teamId) {
      return [];
    }
    return players.filter((player) => player.soldToTeamId === teamId);
  }, [players, teamId]);

  const availablePlayers = useMemo(
    () =>
      players
        .filter((player) => !player.soldToTeamId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [players],
  );

  const selectedPlayer = useMemo(
    () =>
      availablePlayers.find((player) => player.id === selectedPlayerId) ?? null,
    [availablePlayers, selectedPlayerId],
  );

  if (!teamId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-muted-foreground">Team not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            {team ? formatTeamLabel(team) : "Team"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing((prev) => !prev)}
              disabled={editSaving}
            >
              {isEditing ? "Cancel edit" : "Edit team"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft /> Back
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total purse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatAmount(team?.totalPurse ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatAmount(
                team?.spentAmount ??
                  (team?.totalPurse ?? 0) - (team?.remainingPurse ?? 0),
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatAmount(team?.remainingPurse ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
          </CardHeader>
          <CardContent>{teamPlayers.length} / 9</CardContent>
        </Card>
      </div>

      {user ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Add player (Admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Search team-less players</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setPlayerCommandOpen(true)}
                disabled={assigning}
              >
                {selectedPlayer
                  ? `${selectedPlayer.name} · ${selectedPlayer.role}`
                  : "Select player"}
              </Button>
              <CommandDialog
                open={playerCommandOpen}
                onOpenChange={setPlayerCommandOpen}
                title="Select player"
                description="Search team-less players"
              >
                <CommandInput placeholder="Search players..." />
                <CommandList>
                  <CommandEmpty>No available players.</CommandEmpty>
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={async () => {
                  if (!teamId || !selectedPlayerId) {
                    setAssignError("Select a player to add.");
                    return;
                  }
                  setAssignError(null);
                  setAssigning(true);
                  try {
                    await updateDoc(doc(db, "players", selectedPlayerId), {
                      status: "SOLD",
                      soldToTeamId: teamId,
                      soldPrice: 0,
                      soldAt: Date.now(),
                    });
                    setSelectedPlayerId("");
                  } catch (err) {
                    setAssignError(
                      err instanceof Error
                        ? err.message
                        : "Unable to add player.",
                    );
                  } finally {
                    setAssigning(false);
                  }
                }}
                disabled={!selectedPlayerId || assigning}
                isLoading={assigning}
              >
                Add to team (no purse impact)
              </Button>
              <span className="text-xs text-muted-foreground">
                Assigns player with price 0.
              </span>
            </div>
            {assignError ? (
              <p className="text-sm text-destructive">{assignError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {user && isEditing ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Edit Team (Admin)</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!team) {
                  return;
                }
                setEditError(null);
                const spentAmount = Number(editForm.spentAmount || 0);
                const remainingPurse = Number(editForm.remainingPurse || 0);
                if (!editForm.name.trim() || !editForm.captainName.trim()) {
                  setEditError("Team name and captain are required.");
                  return;
                }
                if (Number.isNaN(spentAmount) || Number.isNaN(remainingPurse)) {
                  setEditError("Spent and remaining must be valid numbers.");
                  return;
                }
                setEditSaving(true);
                try {
                  await updateDoc(doc(db, "teams", team.id), {
                    name: editForm.name.trim(),
                    captainName: editForm.captainName.trim(),
                    spentAmount,
                    remainingPurse,
                  });
                  setIsEditing(false);
                } catch (err) {
                  setEditError(
                    err instanceof Error
                      ? err.message
                      : "Unable to update team.",
                  );
                } finally {
                  setEditSaving(false);
                }
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-team-name">Team name</Label>
                  <Input
                    id="edit-team-name"
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-captain-name">Captain name</Label>
                  <Input
                    id="edit-captain-name"
                    value={editForm.captainName}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        captainName: event.target.value,
                      }))
                    }
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-spent">Spent</Label>
                  <Input
                    id="edit-spent"
                    type="number"
                    min={0}
                    value={editForm.spentAmount}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        spentAmount: event.target.value,
                      }))
                    }
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-remaining">Remaining</Label>
                  <Input
                    id="edit-remaining"
                    type="number"
                    min={0}
                    value={editForm.remainingPurse}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        remainingPurse: event.target.value,
                      }))
                    }
                    disabled={editSaving}
                  />
                </div>
              </div>
              {editError ? (
                <p className="text-sm text-destructive">{editError}</p>
              ) : null}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={editSaving}
                  isLoading={editSaving}
                >
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editSaving}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Squad</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamPlayers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No players sold to this team yet.
                  </TableCell>
                </TableRow>
              ) : (
                teamPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <Link
                        className="text-sm font-medium text-primary"
                        to={`/auction/players/${player.id}`}
                      >
                        {player.name}
                      </Link>
                    </TableCell>
                    <TableCell>{player.role}</TableCell>
                    <TableCell>
                      {player.soldPrice ? formatAmount(player.soldPrice) : "-"}
                    </TableCell>
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

export default AuctionTeamPage;
