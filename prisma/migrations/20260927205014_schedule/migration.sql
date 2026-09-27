-- CreateEnum
CREATE TYPE "ScheduleExceptionKind" AS ENUM ('cancelled', 'extra');

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "durationMinutes" SMALLINT NOT NULL,
    "gameId" TEXT,
    "titleEn" VARCHAR(120) NOT NULL DEFAULT '',
    "titleDe" VARCHAR(120) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "kind" "ScheduleExceptionKind" NOT NULL,
    "date" DATE NOT NULL,
    "slotId" TEXT,
    "startTime" VARCHAR(5),
    "durationMinutes" SMALLINT,
    "gameId" TEXT,
    "titleEn" VARCHAR(120) NOT NULL DEFAULT '',
    "titleDe" VARCHAR(120) NOT NULL DEFAULT '',
    "noteEn" VARCHAR(200) NOT NULL DEFAULT '',
    "noteDe" VARCHAR(200) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleSlot_weekday_idx" ON "ScheduleSlot"("weekday");

-- CreateIndex
CREATE INDEX "ScheduleException_date_idx" ON "ScheduleException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_slotId_date_key" ON "ScheduleException"("slotId", "date");

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-added checks (Prisma can't express CHECK constraints).
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7);
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_startTime_check" CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_duration_check" CHECK ("durationMinutes" BETWEEN 15 AND 1440);
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_shape_check" CHECK (
  ("kind" = 'cancelled' AND "slotId" IS NOT NULL)
  OR ("kind" = 'extra' AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "durationMinutes" BETWEEN 15 AND 1440)
);
