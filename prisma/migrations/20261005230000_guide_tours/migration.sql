-- CreateTable
CREATE TABLE "GuideTourSeen" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "tourId" VARCHAR(40) NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuideTourSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuideTourSeen_userId_tourId_key" ON "GuideTourSeen"("userId", "tourId");


-- Hand-added checks (Prisma can't express CHECK constraints).
ALTER TABLE "GuideTourSeen" ADD CONSTRAINT "GuideTourSeen_tour_check" CHECK ("tourId" ~ '^[a-z][a-z-]{1,39}$');
