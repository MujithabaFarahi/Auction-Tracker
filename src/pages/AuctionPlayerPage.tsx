import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";

import { PlayerPhoto } from "@/components/auction/PlayerPhoto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { formatAmount, formatTeamLabel } from "@/lib/format";
import {
  getPlayerDocRef,
  getTeamsCollectionRef,
  type Player,
  type Team,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function AuctionPlayerPage() {
  const { tournamentId, playerId } = useParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    if (!tournamentId || !playerId) {
      return;
    }
    const playerRef = getPlayerDocRef(tournamentId, playerId);
    const unsubscribe = onSnapshot(playerRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPlayer(null);
        return;
      }
      setPlayer(snapshot.data());
    });
    return () => unsubscribe();
  }, [playerId, tournamentId]);

  useEffect(() => {
    if (!tournamentId) {
      return;
    }
    const unsubscribe = onSnapshot(getTeamsCollectionRef(tournamentId), (snapshot) => {
      setTeams(snapshot.docs.map((docSnap) => docSnap.data()));
    });
    return () => unsubscribe();
  }, [tournamentId]);

  const team = useMemo(
    () => teams.find((item) => item.id === player?.soldToTeamId) ?? null,
    [teams, player?.soldToTeamId],
  );

  const statusLabel = useMemo(() => {
    if (!player) {
      return null;
    }
    if (player.status === "SOLD") {
      return "Sold";
    }
    if (player.status === "UNSOLD") {
      return "Unsold";
    }
    if (player.status === "DRAFTED") {
      return "Drafted";
    }
    return "Available";
  }, [player]);

  if (!tournamentId || !playerId) {
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
          <div className="flex min-w-0 items-center gap-4">
            <PlayerPhoto
              name={player?.name}
              imageUrl={player?.imageUrl}
              size="preview"
            />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold">
                {player?.name ?? "Player"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {player?.role ?? ""}
              </p>
            </div>
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
                {player?.status === "DRAFTED"
                  ? "Drafted"
                  : player?.soldPrice
                    ? formatAmount(player.soldPrice)
                    : "-"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {player?.regularTeam?.trim() ? (
              <p>
                Regular team:{" "}
                <span className="font-medium">
                  {player.regularTeam}
                </span>
              </p>
            ) : null}
            <p>
              Team:{" "}
              {team ? (
                <Link
                  className="text-primary"
                  to={`/auction/tournaments/${tournamentId}/teams/${team.id}`}
                >
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

export default AuctionPlayerPage;
