import Image from "next/image";
import { cn } from "@/lib/utils";

// A game's Twitch box art (3:4), loaded through our image optimizer
// (static-cdn.jtvnw.net is in images.remotePatterns). Without art: a quiet
// tile with the game's initials. Decorative -- the game name is always shown
// next to it.
export function GameCover({
  name,
  boxArtUrl,
  className,
  sizes = "4rem",
  muted = false,
}: {
  name: string;
  boxArtUrl: string | null;
  className?: string;
  sizes?: string;
  muted?: boolean;
}) {
  const initials = name
    .split(/[\s:]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[3/4] shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border",
        muted && "opacity-60 grayscale",
        className,
      )}
    >
      {boxArtUrl ? (
        <Image src={boxArtUrl} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-muted-foreground">
          {initials}
        </span>
      )}
    </div>
  );
}
