-- CreateTable
CREATE TABLE "TwitchScheduleConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "refreshTokenEnc" TEXT NOT NULL,
    "broadcasterId" VARCHAR(20) NOT NULL,
    "login" VARCHAR(25) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "titleLocale" VARCHAR(2) NOT NULL DEFAULT 'de',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" VARCHAR(40) NOT NULL DEFAULT '',
    "connectedBy" VARCHAR(120) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchScheduleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchScheduleSegment" (
    "id" TEXT NOT NULL,
    "occurrenceKey" VARCHAR(80) NOT NULL,
    "segmentId" VARCHAR(200) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchScheduleSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchScheduleSegment_occurrenceKey_key" ON "TwitchScheduleSegment"("occurrenceKey");

-- CreateIndex
CREATE INDEX "TwitchScheduleSegment_startAt_idx" ON "TwitchScheduleSegment"("startAt");


-- Hand-added checks (Prisma can't express CHECK constraints).
ALTER TABLE "TwitchScheduleConnection" ADD CONSTRAINT "TwitchScheduleConnection_singleton" CHECK ("id" = 1);
ALTER TABLE "TwitchScheduleConnection" ADD CONSTRAINT "TwitchScheduleConnection_locale_check" CHECK ("titleLocale" IN ('de', 'en'));
ALTER TABLE "TwitchScheduleConnection" ADD CONSTRAINT "TwitchScheduleConnection_encrypted_check" CHECK ("refreshTokenEnc" LIKE 'v1.%');
ALTER TABLE "TwitchScheduleConnection" ADD CONSTRAINT "TwitchScheduleConnection_broadcaster_check" CHECK ("broadcasterId" ~ '^[0-9]{1,20}$');
