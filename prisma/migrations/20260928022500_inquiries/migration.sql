-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('new', 'in_progress', 'done', 'spam');

-- CreateEnum
CREATE TYPE "InquiryBudget" AS ENUM ('under_500', 'from_500_to_2000', 'from_2000_to_5000', 'over_5000', 'unsure');

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "company" VARCHAR(120) NOT NULL,
    "contactName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "budget" "InquiryBudget" NOT NULL,
    "message" VARCHAR(3000) NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt");

