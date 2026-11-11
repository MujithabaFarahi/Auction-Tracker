import { PlayerPhoto } from "@/components/auction/PlayerPhoto";

type PlayerTileProps = {
  name: string;
  role: string;
  imageUrl?: string | null;
  basePrice: string;
  onClick?: () => void;
};

function PlayerTile({ name, role, imageUrl, basePrice, onClick }: PlayerTileProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 p-3 transition hover:-translate-y-0.5 hover:bg-muted/20 hover:shadow-sm cursor-pointer"
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-2">
        <PlayerPhoto name={name} imageUrl={imageUrl} />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-primary capitalize">
            {name.toLowerCase()}
          </p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs uppercase text-muted-foreground">Base Price</p>
        <p className="text-sm font-semibold">{basePrice}</p>
      </div>
    </div>
  );
}

export { PlayerTile };
