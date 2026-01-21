import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format";
import { db } from "@/lib/firebase";
import { playersCollectionRef, type Player, type Team } from "@/lib/firestore";

function AuctionTeamPage() {
  const { teamId } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

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
            {team?.name ?? "Team"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Captain: {team?.captainName ?? "-"}
          </p>
        </div>
        <Link to="/auction/view" className="text-sm font-medium text-primary">
          Back to auction
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
          <CardContent>
            <Badge>{teamPlayers.length}</Badge>
          </CardContent>
        </Card>
      </div>

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
                      {player.soldPrice
                        ? formatAmount(player.soldPrice)
                        : "-"}
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
