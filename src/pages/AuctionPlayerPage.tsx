import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { formatAmount, formatTeamLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { teamsCollectionRef, type Player, type Team } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function AuctionPlayerPage() {
  const { playerId } = useParams();
  const { user } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  const navigate = useNavigate();

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
    const unsubscribe = onSnapshot(teamsCollectionRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Team, "id">),
      }));
      setTeams(data);
    });
    return () => unsubscribe();
  }, []);

  const team = useMemo(
    () => teams.find((item) => item.id === player?.soldToTeamId) ?? null,
    [teams, player?.soldToTeamId],
  );

  const statusLabel = useMemo(() => {
    if (!player) {
      return null;
    }
    return player.status === "SOLD" ? "Sold" : "Available";
  }, [player]);

  if (!playerId) {
    return (
      <div className="flex min-h-svh flex-col">
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          <p className="text-sm text-muted-foreground">Player not found.</p>
        </div>
        <footer className="mt-auto border-t pt-4 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://teqgrow.com/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Teqgrow
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">
              {player?.name ?? "Player"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {player?.role ?? ""}
            </p>
          </div>

          <Button variant={"ghost"} onClick={() => navigate(-1)}>
            <ArrowLeft /> Back
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
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
            {user ? (
              <p>
                Contact:{" "}
                <span className="font-medium">
                  {player?.contactNumber ?? "-"}
                </span>
              </p>
            ) : null}
            <p>
              Team:{" "}
              {team ? (
                <Link className="text-primary" to={`/auction/teams/${team.id}`}>
                  {formatTeamLabel(team)}
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
                  {[...player.bidHistory].reverse().map((bid, index) => (
                    <div
                      key={`${bid.teamId}-${bid.timestamp}-${index}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span>
                        {formatTeamLabel(
                          teams.find((item) => item.id === bid.teamId) ?? {
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
      <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href="https://teqgrow.com/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Teqgrow
        </a>
      </footer>
    </div>
  );
}

export default AuctionPlayerPage;
