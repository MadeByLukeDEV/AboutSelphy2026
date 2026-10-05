-- CreateTable
CREATE TABLE "DiscordSchedule" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "webhookUrlEnc" TEXT NOT NULL,
    "webhookId" VARCHAR(30) NOT NULL,
    "webhookName" VARCHAR(80) NOT NULL DEFAULT '',
    "channelId" VARCHAR(30) NOT NULL DEFAULT '',
    "guildId" VARCHAR(30) NOT NULL DEFAULT '',
    "locale" VARCHAR(2) NOT NULL DEFAULT 'de',
    "autoUpdate" BOOLEAN NOT NULL DEFAULT true,
    "messageId" VARCHAR(30),
    "contentHash" VARCHAR(64),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" VARCHAR(40) NOT NULL DEFAULT '',
    "connectedBy" VARCHAR(120) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordSchedule_pkey" PRIMARY KEY ("id")
);


-- Hand-added checks (Prisma can't express CHECK constraints).
ALTER TABLE "DiscordSchedule" ADD CONSTRAINT "DiscordSchedule_singleton" CHECK ("id" = 1);
ALTER TABLE "DiscordSchedule" ADD CONSTRAINT "DiscordSchedule_locale_check" CHECK ("locale" IN ('de', 'en'));
ALTER TABLE "DiscordSchedule" ADD CONSTRAINT "DiscordSchedule_encrypted_check" CHECK ("webhookUrlEnc" LIKE 'v1.%');
