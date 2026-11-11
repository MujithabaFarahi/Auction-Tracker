import { useEffect, useState } from "react";
import { getCountFromServer } from "firebase/firestore";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/format";
import {
  getPlayersCollectionRef,
  getTeamsCollectionRef,
  type Tournament,
} from "@/lib/firestore";

type TournamentCardProps = {
  tournament: Tournament;
  isLive: boolean;
};

type TournamentCounts = {
  teams: number | null;
  players: number | null;
};

function countLabel(count: number | null | undefined) {
  if (count === undefined) return "…";
  if (count === null) return "Unavailable";
  return formatAmount(count);
}

export function TournamentCard({ tournament, isLive }: TournamentCardProps) {
  const [counts, setCounts] = useState<TournamentCounts>();
  const { id, name, season, status } = tournament;
  const statusLabel = isLive ? "Live" : status === "COMPLETED" ? "Completed" : "Pending";

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      getCountFromServer(getTeamsCollectionRef(id)),
      getCountFromServer(getPlayersCollectionRef(id)),
    ]).then(([teams, players]) => {
      if (cancelled) return;
      setCounts({
        teams: teams.status === "fulfilled" ? teams.value.data().count : null,
        players: players.status === "fulfilled" ? players.value.data().count : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Link
      to={{ search: new URLSearchParams({ tournament: id }).toString() }}
      className="flex h-full flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">{season}</p>
        </div>
        <Badge variant={isLive ? "default" : "secondary"}>{statusLabel}</Badge>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-4 border-t pt-3">
        <div>
          <dt className="text-sm text-muted-foreground">Teams</dt>
          <dd className="font-semibold tabular-nums">{countLabel(counts?.teams)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Players</dt>
          <dd className="font-semibold tabular-nums">{countLabel(counts?.players)}</dd>
        </div>
      </dl>
    </Link>
  );
}
