import Image from "next/image";
import { cn } from "@/lib/utils";

// A game's cover, square (1:1) everywhere: an uploaded image (/api/media/...) or the Twitch
// box art (portrait, cropped to the centre), both through our image
// optimizer. Without either: a quiet tile
// with the game's initials. Decorative -- the game name is always shown
// next to it.
export function GameCover({
  name,
  src,
  className,
  sizes = "4rem",
  muted = false,
}: {
  name: string;
  src: string | null;
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
        "relative aspect-square shrink-0 self-start overflow-hidden rounded-lg bg-muted ring-1 ring-border",
        muted && "opacity-60 grayscale",
        className,
      )}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-muted-foreground">
          {initials}
        </span>
      )}
    </div>
  );
}
