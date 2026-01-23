import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LiveInfoCardProps = {
  title: string;
  primary: string;
  secondary?: string;
  meta?: ReactNode;
};

function LiveInfoCard({ title, primary, secondary, meta }: LiveInfoCardProps) {
  return (
    <Card className="border-muted/60 bg-background/80 p-4 gap-2">
      <CardHeader className="gap-2 p-0">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <div>
          <p className="text-lg font-semibold">{primary}</p>
          {secondary ? (
            <p className="text-sm text-muted-foreground">{secondary}</p>
          ) : null}
        </div>
      </CardHeader>
      {meta ? <CardContent className="p-0 text-sm ">{meta}</CardContent> : null}
    </Card>
  );
}

export { LiveInfoCard };
