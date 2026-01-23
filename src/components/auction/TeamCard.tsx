import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TeamCardProps = {
  name: string;
  spent: string;
  remaining: string;
  playersCount: number;
  onClick?: () => void;
};

function TeamCard({
  name,
  spent,
  remaining,
  playersCount,
  onClick,
}: TeamCardProps) {
  return (
    <Card
      className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md py-4 gap-3"
      onClick={onClick}
    >
      <CardHeader className="gap-0">
        <CardTitle className="text-base">{name}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Players: {playersCount} / 9
        </p>
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
