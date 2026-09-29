-- CreateEnum
CREATE TYPE "AudienceDimension" AS ENUM ('age', 'gender', 'country', 'device');

-- CreateTable
CREATE TABLE "YoutubeConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "channelId" VARCHAR(30) NOT NULL,
    "encryptedRefreshToken" VARCHAR(2000) NOT NULL,
    "connectedBy" VARCHAR(100) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "showInMediaKit" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "dimension" "AudienceDimension" NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudienceSnapshot_dimension_capturedAt_idx" ON "AudienceSnapshot"("dimension", "capturedAt");


-- Hand-added: singleton row, sane shares and periods.
ALTER TABLE "YoutubeConnection" ADD CONSTRAINT "YoutubeConnection_singleton" CHECK ("id" = 1);
ALTER TABLE "AudienceSnapshot" ADD CONSTRAINT "AudienceSnapshot_share_range" CHECK ("share" >= 0 AND "share" <= 100);
ALTER TABLE "AudienceSnapshot" ADD CONSTRAINT "AudienceSnapshot_period_order" CHECK ("periodStart" <= "periodEnd");
