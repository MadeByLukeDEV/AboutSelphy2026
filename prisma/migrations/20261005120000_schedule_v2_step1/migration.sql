-- CreateEnum
CREATE TYPE "StreamCategoryColor" AS ENUM ('green', 'blue', 'violet', 'amber', 'rose', 'slate');

-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "twitchBoxArtUrl" VARCHAR(300),
ADD COLUMN     "twitchCategoryId" VARCHAR(20),
ADD COLUMN     "twitchCategoryName" VARCHAR(120);

-- AlterTable
ALTER TABLE "ScheduleException" ADD COLUMN     "cancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twitchBoxArtUrl" VARCHAR(300),
ADD COLUMN     "twitchCategoryId" VARCHAR(20),
ADD COLUMN     "twitchCategoryName" VARCHAR(120);

-- CreateTable
CREATE TABLE "StreamCategory" (
    "id" TEXT NOT NULL,
    "nameEn" VARCHAR(40) NOT NULL,
    "nameDe" VARCHAR(40) NOT NULL,
    "color" "StreamCategoryColor" NOT NULL DEFAULT 'green',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ScheduleSlotToStreamCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ScheduleSlotToStreamCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ScheduleExceptionToStreamCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ScheduleExceptionToStreamCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ScheduleSlotToStreamCategory_B_index" ON "_ScheduleSlotToStreamCategory"("B");

-- CreateIndex
CREATE INDEX "_ScheduleExceptionToStreamCategory_B_index" ON "_ScheduleExceptionToStreamCategory"("B");

-- AddForeignKey
ALTER TABLE "_ScheduleSlotToStreamCategory" ADD CONSTRAINT "_ScheduleSlotToStreamCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "ScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScheduleSlotToStreamCategory" ADD CONSTRAINT "_ScheduleSlotToStreamCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "StreamCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScheduleExceptionToStreamCategory" ADD CONSTRAINT "_ScheduleExceptionToStreamCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "ScheduleException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScheduleExceptionToStreamCategory" ADD CONSTRAINT "_ScheduleExceptionToStreamCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "StreamCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added checks (Prisma can't express CHECK constraints).
-- A stream's game is either one of our Games or a Twitch category, never both.
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_game_or_twitch_check" CHECK ("gameId" IS NULL OR "twitchCategoryId" IS NULL);
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_game_or_twitch_check" CHECK ("gameId" IS NULL OR "twitchCategoryId" IS NULL);
-- A Twitch category always comes with its name; covers only from Twitch's CDN.
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_twitch_shape_check" CHECK ("twitchCategoryId" IS NULL OR ("twitchCategoryName" IS NOT NULL AND ("twitchBoxArtUrl" IS NULL OR "twitchBoxArtUrl" LIKE 'https://static-cdn.jtvnw.net/%')));
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_twitch_shape_check" CHECK ("twitchCategoryId" IS NULL OR ("twitchCategoryName" IS NOT NULL AND ("twitchBoxArtUrl" IS NULL OR "twitchBoxArtUrl" LIKE 'https://static-cdn.jtvnw.net/%')));
-- Only one-time streams carry their own cancelled flag (weekly ones are
-- cancelled through a "cancelled" exception row).
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_cancelled_check" CHECK ("cancelled" = false OR "kind" = 'extra');
ALTER TABLE "StreamCategory" ADD CONSTRAINT "StreamCategory_names_check" CHECK (length(trim("nameEn")) > 0 AND length(trim("nameDe")) > 0);
