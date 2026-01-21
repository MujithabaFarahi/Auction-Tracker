import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/format";
import { db } from "@/lib/firebase";
import { type Player, type Team } from "@/lib/firestore";

function AuctionPlayerPage() {
  const { playerId } = useParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (!playerId) {
      return;
    }
    const playerRef = doc(db, "players", playerId);
    const unsubscribe = onSnapshot(playerRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPlayer(null);
        return;
      }
      const playerData = {
        id: snapshot.id,
        ...(snapshot.data() as Omit<Player, "id">),
      };
      setPlayer(playerData);
    });
    return () => unsubscribe();
  }, [playerId]);

  useEffect(() => {
    if (!player?.soldToTeamId) {
      setTeam(null);
      return;
    }
    const teamRef = doc(db, "teams", player.soldToTeamId);
    const unsubscribe = onSnapshot(teamRef, (snapshot) => {
      if (!snapshot.exists()) {
        setTeam(null);
        return;
      }
      setTeam({ id: snapshot.id, ...(snapshot.data() as Omit<Team, "id">) });
    });
    return () => unsubscribe();
  }, [player?.soldToTeamId]);

  const statusLabel = useMemo(() => {
    if (!player) {
      return null;
    }
    return player.status === "SOLD" ? "Sold" : "Available";
  }, [player]);

  if (!playerId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-muted-foreground">Player not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            {player?.name ?? "Player"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {player?.role ?? ""}
          </p>
        </div>
        <Link to="/auction/view" className="text-sm font-medium text-primary">
          Back to auction
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusLabel ? <Badge>{statusLabel}</Badge> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Base price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatAmount(player?.basePrice ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sold price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {player?.soldPrice ? formatAmount(player.soldPrice) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Contact: <span className="font-medium">{player?.contactNumber ?? "-"}</span>
          </p>
          <p>
            Team:{" "}
            {team ? (
              <Link className="text-primary" to={`/auction/teams/${team.id}`}>
                {team.name}
              </Link>
            ) : (
              "-"
            )}
          </p>
        </CardContent>
      </Card>

      {player?.status === "SOLD" ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Bidding History</CardTitle>
          </CardHeader>
          <CardContent>
            {player.bidHistory?.length ? (
              <div className="space-y-2 text-sm">
                {player.bidHistory.map((bid, index) => (
                  <div
                    key={`${bid.teamId}-${bid.timestamp}-${index}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span>{bid.teamName}</span>
                    <span className="font-semibold">
                      {formatAmount(bid.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No bid history recorded for this player.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default AuctionPlayerPage;
