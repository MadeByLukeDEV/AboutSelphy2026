-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "code" VARCHAR(40) NOT NULL DEFAULT '',
    "descriptionEn" VARCHAR(300) NOT NULL,
    "descriptionDe" VARCHAR(300) NOT NULL,
    "logoId" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "titleEn" VARCHAR(80) NOT NULL,
    "titleDe" VARCHAR(80) NOT NULL,
    "descriptionEn" VARCHAR(600) NOT NULL,
    "descriptionDe" VARCHAR(600) NOT NULL,
    "priceFrom" INTEGER,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_logoId_key" ON "Partner"("logoId");

-- CreateIndex
CREATE INDEX "Partner_visible_sortOrder_idx" ON "Partner"("visible", "sortOrder");

-- CreateIndex
CREATE INDEX "Package_visible_sortOrder_idx" ON "Package"("visible", "sortOrder");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-added (Prisma can't express CHECK constraints).
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_url_https" CHECK ("url" LIKE 'https://%');
ALTER TABLE "Package" ADD CONSTRAINT "Package_priceFrom_range" CHECK ("priceFrom" IS NULL OR ("priceFrom" >= 0 AND "priceFrom" <= 1000000));
