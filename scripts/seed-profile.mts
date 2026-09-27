/**
 * Seeds the initial home/about content: the Profile row and the game list.
 * Insert-only -- rows that already exist are left alone, so it never
 * overwrites edits made in /admin. Safe to run repeatedly.
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/seed-profile.mts
 *
 * (react-server condition: src/lib/prisma.ts imports "server-only".)
 * Local dev and production share the database -- this writes real content.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const { prisma } = await import("../src/lib/prisma.ts");

const profile = {
  displayName: "AboutSelphy",
  taglineEn:
    "Sea of Thieves and Hunt: Showdown streams from someone who knows these games inside out.",
  taglineDe:
    "Sea of Thieves und Hunt: Showdown – gestreamt von jemandem, der diese Spiele in- und auswendig kennt.",
  bioEn: [
    "Most of my streams happen on the Sea of Thieves: Hourglass PvP battles, and tucking with my crew – hiding aboard enemy ships and waiting for exactly the right moment.",
    "When I'm not sailing, I play Hunt: Showdown at a high level (MMR 5 of 6). I play to win, but I'd rather do it with weapons hardly anyone picks, like the Bomb Lance.",
    "I'm not the loudest streamer, and not the sweatiest either. What you get instead is someone who knows these games in depth – the mechanics, the tricks and the reasons behind them – and is happy to explain them.",
    "Off stream I'm a web developer (this site included) and a big anime fan.",
  ].join("\n\n"),
  bioDe: [
    "Die meisten meiner Streams spielen auf dem Sea of Thieves: Hourglass-PvP-Gefechte und Tucking mit meiner Crew – an Bord gegnerischer Schiffe verstecken und auf genau den richtigen Moment warten.",
    "Wenn ich nicht segle, spiele ich Hunt: Showdown auf hohem Niveau (MMR 5 von 6). Ich spiele, um zu gewinnen – aber am liebsten mit Waffen, die kaum jemand nimmt, wie der Bomb Lance.",
    "Ich bin nicht der lauteste Streamer und auch nicht der verbissenste. Dafür bekommst du jemanden, der diese Spiele im Detail kennt – die Mechaniken, die Tricks und die Gründe dahinter – und sie gern erklärt.",
    "Abseits vom Stream bin ich Webentwickler (diese Seite inklusive) und großer Anime-Fan.",
  ].join("\n\n"),
};

const games = [
  {
    slug: "sea-of-thieves",
    name: "Sea of Thieves",
    status: "main",
    sortOrder: 0,
    tags: ["Hourglass PvP", "Tucking", "Crew"],
    blurbEn:
      "Where most streams happen: Hourglass PvP battles and tucking with my crew.",
    blurbDe:
      "Hier spielen die meisten Streams: Hourglass-PvP-Gefechte und Tucking mit meiner Crew.",
  },
  {
    slug: "hunt-showdown",
    name: "Hunt: Showdown",
    status: "regular",
    sortOrder: 1,
    tags: ["MMR 5/6", "Off-meta", "Bomb Lance"],
    blurbEn:
      "Competitive at MMR 5 of 6 – often with off-meta weapons like the Bomb Lance.",
    blurbDe:
      "Kompetitiv auf MMR 5 von 6 – oft mit Off-Meta-Waffen wie der Bomb Lance.",
  },
  {
    slug: "wardogs",
    name: "Wardogs",
    status: "new",
    sortOrder: 2,
    tags: [],
    blurbEn: "Recently started – learning it live on stream.",
    blurbDe: "Gerade erst angefangen – ich lerne es live im Stream.",
  },
  {
    slug: "genshin-impact",
    name: "Genshin Impact",
    status: "former",
    sortOrder: 3,
    tags: [],
    blurbEn: "Played it for a long time; not on the schedule anymore.",
    blurbDe: "Lange gespielt, aktuell nicht mehr im Streamplan.",
  },
] as const;

try {
  const existing = await prisma.profile.findUnique({ where: { id: 1 } });
  if (existing) {
    console.log("Profile exists -- left unchanged.");
  } else {
    await prisma.profile.create({ data: { id: 1, ...profile } });
    console.log("Profile created.");
  }

  for (const game of games) {
    const result = await prisma.game.upsert({
      where: { slug: game.slug },
      create: { ...game, tags: [...game.tags] },
      update: {}, // insert-only: never overwrite admin edits
    });
    console.log(`Game ${result.slug}: ok`);
  }
} finally {
  await prisma.$disconnect();
}
