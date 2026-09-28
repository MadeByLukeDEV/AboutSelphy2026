-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "customCoverId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" VARCHAR(40) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_customCoverId_key" ON "Game"("customCoverId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_customCoverId_fkey" FOREIGN KEY ("customCoverId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

