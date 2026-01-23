import type { MouseEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlayerCardProps = {
  name: string;
  role: string;
  badge?: string;
  teamLabel?: string;
  basePrice: string;
  finalPrice?: string;
  onClick?: () => void;
  onTeamClick?: (event: MouseEvent) => void;
  variant?: "available" | "completed";
};

function PlayerCard({
  name,
  role,
  badge,
  teamLabel,
  basePrice,
  finalPrice,
  onClick,
  onTeamClick,
  variant = "available",
}: PlayerCardProps) {
  return (
    <Card
      className="cursor-pointer border-muted/60 bg-background/80 transition hover:-translate-y-0.5 hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="space-y-2">
        {variant === "available" ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">Base</p>
              <p className="text-sm font-semibold">{basePrice}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{name}</CardTitle>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
              {badge ? <Badge className="shrink-0">{badge}</Badge> : null}
            </div>
            <div className="text-sm">
              <p className="text-xs uppercase text-muted-foreground">Team</p>
              {teamLabel ? (
                <span
                  className="text-sm font-medium text-primary"
                  onClick={onTeamClick}
                >
                  {teamLabel}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </>
        )}
      </CardHeader>
      {variant === "completed" ? (
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              Base price
            </p>
            <p className="text-lg font-semibold">{basePrice}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              Final price
            </p>
            <p className="text-lg font-semibold">{finalPrice ?? "-"}</p>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

export { PlayerCard };
