"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

// Click-to-load player: shows the (optimized, same-origin) thumbnail until
// someone presses play, then swaps in the iframe. Keeps third-party players,
// their scripts and trackers off the page until they're actually wanted.
export function VideoFacade({
  embedSrc,
  thumbnailUrl,
  title,
  playLabel,
  vertical = false,
  sizes,
  preload = false,
}: {
  embedSrc: string;
  thumbnailUrl: string;
  title: string;
  /** Accessible name of the play button, e.g. "Play: <title>". */
  playLabel: string;
  vertical?: boolean;
  sizes: string;
  preload?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const frame = cn(
    "relative w-full overflow-hidden rounded-xl bg-muted",
    vertical ? "aspect-[9/16]" : "aspect-video",
  );

  if (playing) {
    return (
      <div className={frame}>
        <iframe
          src={embedSrc}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={playLabel}
      className={cn(frame, "group block cursor-pointer")}
    >
      <Image
        src={thumbnailUrl}
        alt=""
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Play className="size-6 translate-x-0.5 fill-current" aria-hidden />
        </span>
      </span>
    </button>
  );
}
