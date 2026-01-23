type PlayerTileProps = {
  name: string;
  role: string;
  basePrice: string;
  onClick?: () => void;
};

function PlayerTile({ name, role, basePrice, onClick }: PlayerTileProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 p-3 transition hover:-translate-y-0.5 hover:bg-muted/20 hover:shadow-sm cursor-pointer"
      onClick={onClick}
    >
      <div>
        <p className="text-sm font-semibold text-primary capitalize">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
      <div className="text-right">
        <p className="text-xs uppercase text-muted-foreground">Base Price</p>
        <p className="text-sm font-semibold">{basePrice}</p>
      </div>
    </div>
  );
}

export { PlayerTile };
