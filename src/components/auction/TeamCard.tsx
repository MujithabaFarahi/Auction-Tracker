import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "../ui/badge";

type TeamCardProps = {
  name: string;
  captain: string;
  spent: string;
  remaining: string;
  playersCount: number;
  teamSize?: number;
  onClick?: () => void;
};

function TeamCard({
  name,
  captain,
  spent,
  remaining,
  playersCount,
  teamSize = 9,
  onClick,
}: TeamCardProps) {
  return (
    <Card
      className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md py-4 gap-3"
      onClick={onClick}
    >
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base capitalize">
              {name.toLowerCase()}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Players: {playersCount} / {teamSize}
            </p>
          </div>
          <Badge
            variant="outline"
            className="h-8 px-3 py-1 text-sm font-semibold capitalize"
          >
            {captain.toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm grid-cols-2 p-0">
        <div className="text-center p-3">
          <p className="text-xs uppercase text-muted-foreground">Spent</p>
          <p className="text-lg font-semibold">{spent}</p>
        </div>
        <div className="text-center p-3">
          <p className="text-xs uppercase text-muted-foreground">Remaining</p>
          <p className="text-lg font-semibold">{remaining}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export { TeamCard };
