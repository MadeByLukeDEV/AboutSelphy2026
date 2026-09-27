-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('main', 'regular', 'new', 'former');

-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "displayName" VARCHAR(80) NOT NULL,
    "taglineDe" VARCHAR(200) NOT NULL,
    "taglineEn" VARCHAR(200) NOT NULL,
    "bioDe" TEXT NOT NULL,
    "bioEn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "GameStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "blurbDe" VARCHAR(400) NOT NULL,
    "blurbEn" VARCHAR(400) NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Game_status_sortOrder_idx" ON "Game"("status", "sortOrder");


-- Profile is a singleton (hand-added: Prisma can't express CHECK constraints).
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_singleton" CHECK ("id" = 1);
