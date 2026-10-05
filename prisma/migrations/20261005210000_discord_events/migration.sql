-- CreateTable
CREATE TABLE "DiscordEventConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "botTokenEnc" TEXT NOT NULL,
    "botId" VARCHAR(20) NOT NULL,
    "botName" VARCHAR(80) NOT NULL DEFAULT '',
    "guildId" VARCHAR(20) NOT NULL,
    "guildName" VARCHAR(100) NOT NULL DEFAULT '',
    "locale" VARCHAR(2) NOT NULL DEFAULT 'de',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" VARCHAR(40) NOT NULL DEFAULT '',
    "connectedBy" VARCHAR(120) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordEventConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordScheduleEvent" (
    "id" TEXT NOT NULL,
    "dayKey" VARCHAR(10) NOT NULL,
    "eventId" VARCHAR(20) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordScheduleEvent_dayKey_key" ON "DiscordScheduleEvent"("dayKey");

-- CreateIndex
CREATE INDEX "DiscordScheduleEvent_startAt_idx" ON "DiscordScheduleEvent"("startAt");


-- Hand-added checks (Prisma can't express CHECK constraints).
ALTER TABLE "DiscordEventConnection" ADD CONSTRAINT "DiscordEventConnection_singleton" CHECK ("id" = 1);
ALTER TABLE "DiscordEventConnection" ADD CONSTRAINT "DiscordEventConnection_locale_check" CHECK ("locale" IN ('de', 'en'));
ALTER TABLE "DiscordEventConnection" ADD CONSTRAINT "DiscordEventConnection_encrypted_check" CHECK ("botTokenEnc" LIKE 'v1.%');
ALTER TABLE "DiscordEventConnection" ADD CONSTRAINT "DiscordEventConnection_ids_check" CHECK ("botId" ~ '^[0-9]{17,20}$' AND "guildId" ~ '^[0-9]{17,20}$');
ALTER TABLE "DiscordScheduleEvent" ADD CONSTRAINT "DiscordScheduleEvent_day_check" CHECK ("dayKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "DiscordScheduleEvent" ADD CONSTRAINT "DiscordScheduleEvent_event_check" CHECK ("eventId" ~ '^[0-9]{17,20}$');
