import { useState } from "react";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

function getPhotoUrl(imageUrl: string | null | undefined) {
  if (typeof imageUrl !== "string") {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function getPhotoSrc(url: URL) {
  if (url.hostname === "drive.google.com") {
    const fileMatch = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/);
    const fileId = fileMatch?.[1] ?? url.searchParams.get("id");
    if (fileId && /^[\w-]+$/.test(fileId)) {
      const thumbnail = new URL("https://drive.google.com/thumbnail");
      thumbnail.searchParams.set("id", fileId);
      thumbnail.searchParams.set("sz", "w480");
      const resourceKey = url.searchParams.get("resourcekey");
      if (resourceKey) {
        thumbnail.searchParams.set("resourcekey", resourceKey);
      }
      return thumbnail.href;
    }
  }

  return url.href;
}

type PlayerPhotoProps = {
  name?: string;
  imageUrl?: string | null;
  size?: "thumbnail" | "preview";
};

export function PlayerPhoto({ name, imageUrl, size = "thumbnail" }: PlayerPhotoProps) {
  const url = getPhotoUrl(imageUrl);
  const src = url ? getPhotoSrc(url) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = url && src && src !== failedSrc;
  const preview = size === "preview";

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-muted-foreground",
        preview ? "size-24 sm:size-32" : "size-11",
      )}
    >
      <UserRound
        className={preview ? "size-10" : "size-5"}
        aria-hidden={showPhoto ? true : undefined}
        role={showPhoto ? undefined : "img"}
        aria-label={showPhoto ? undefined : "No player photo available"}
      />
      {showPhoto ? (
        <a
          href={url.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name ? `Open photo of ${name} in a new tab` : "Open player photo in a new tab"}
          className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          onClick={(event) => event.stopPropagation()}
        >
          <img
            key={src}
            src={src}
            alt={name ? `Photo of ${name}` : "Player photo"}
            className="size-full object-cover"
            loading={preview ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailedSrc(src)}
          />
        </a>
      ) : null}
    </div>
  );
}
