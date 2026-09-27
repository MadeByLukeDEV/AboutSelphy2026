-- CreateEnum
CREATE TYPE "StatPlatform" AS ENUM ('twitch', 'youtube');

-- CreateTable
CREATE TABLE "StatSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "platform" "StatPlatform" NOT NULL,
    "metric" VARCHAR(40) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamSession" (
    "id" VARCHAR(40) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "gameName" VARCHAR(120) NOT NULL,
    "peakViewers" INTEGER NOT NULL,
    "viewerSum" BIGINT NOT NULL,
    "sampleCount" INTEGER NOT NULL,

    CONSTRAINT "StreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" BIGSERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "summary" VARCHAR(1000) NOT NULL,
    "trigger" VARCHAR(20) NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatSnapshot_platform_metric_capturedAt_idx" ON "StatSnapshot"("platform", "metric", "capturedAt");

-- CreateIndex
CREATE INDEX "StreamSession_lastSeenAt_idx" ON "StreamSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

