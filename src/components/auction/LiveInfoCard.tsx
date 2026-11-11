import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LiveInfoCardProps = {
  title: string;
  primary: string;
  secondary?: string;
  meta?: ReactNode;
  media?: ReactNode;
};

function LiveInfoCard({ title, primary, secondary, meta, media }: LiveInfoCardProps) {
  return (
    <Card className="border-muted/60 bg-background/80 p-4 gap-2">
      <CardHeader className="gap-2 p-0">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-3">
          {media}
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold capitalize">
              {primary.toLowerCase()}
            </p>
            {secondary ? (
              <p className="text-sm text-muted-foreground">{secondary}</p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {meta ? <CardContent className="p-0 text-sm ">{meta}</CardContent> : null}
    </Card>
  );
}

export { LiveInfoCard };
