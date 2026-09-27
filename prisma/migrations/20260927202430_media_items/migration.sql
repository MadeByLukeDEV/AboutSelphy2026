-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('twitch_vod', 'twitch_clip', 'youtube_video', 'youtube_short');

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "externalId" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "thumbnailUrl" VARCHAR(500) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "views" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaItem_kind_publishedAt_idx" ON "MediaItem"("kind", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_kind_externalId_key" ON "MediaItem"("kind", "externalId");

