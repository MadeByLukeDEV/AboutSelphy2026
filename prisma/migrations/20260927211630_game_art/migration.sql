-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "boxArtUrl" VARCHAR(300),
ADD COLUMN     "twitchCategory" VARCHAR(80) NOT NULL DEFAULT '',
ADD COLUMN     "twitchGameId" VARCHAR(20);

