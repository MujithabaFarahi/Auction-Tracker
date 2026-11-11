import type { MouseEvent } from "react";

import { PlayerPhoto } from "@/components/auction/PlayerPhoto";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlayerCardProps = {
  name: string;
  role: string;
  imageUrl?: string | null;
  badge?: string;
  teamLabel?: string;
  basePrice: string;
  finalPrice?: string;
  onClick?: () => void;
  onTeamClick?: (event: MouseEvent) => void;
};

function PlayerCard({
  name,
  role,
  imageUrl,
  badge,
  teamLabel,
  basePrice,
  finalPrice,
  onClick,
  onTeamClick,
}: PlayerCardProps) {
  return (
    <Card
      className="cursor-pointer border-muted/60 bg-background/80 transition hover:-translate-y-0.5 hover:shadow-md gap-2"
      onClick={onClick}
    >
      <CardHeader>
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <PlayerPhoto name={name} imageUrl={imageUrl} />
              <div className="min-w-0">
                <CardTitle className="break-words text-base capitalize">
                  {name.toLowerCase()}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            </div>
            {badge ? <Badge className="shrink-0">{badge}</Badge> : null}
          </div>
        </>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm grid-cols-3">
        <div className="rounded-md text-center">
          <p className="text-xs  text-muted-foreground">Base price</p>
          <p className="font-semibold">{basePrice}</p>
        </div>
        <div className="rounded-md text-center">
          <p className="text-xs  text-muted-foreground">Final price</p>
          <p className="font-semibold">
            {finalPrice ?? <Badge variant={"outline"}>Drafted</Badge>}
          </p>
        </div>
        <div className="rounded-md text-center" onClick={onTeamClick}>
          <p className="text-xs  text-muted-foreground">Team</p>
          <p className="font-semibold">{teamLabel ?? "-"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export { PlayerCard };
