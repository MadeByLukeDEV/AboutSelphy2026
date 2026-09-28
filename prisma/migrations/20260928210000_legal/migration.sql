-- CreateTable
CREATE TABLE "LegalSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "operatorName" VARCHAR(120) NOT NULL DEFAULT '',
    "street" VARCHAR(120) NOT NULL DEFAULT '',
    "postalCode" VARCHAR(20) NOT NULL DEFAULT '',
    "city" VARCHAR(80) NOT NULL DEFAULT '',
    "country" VARCHAR(80) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "imprintExtraEn" VARCHAR(4000) NOT NULL DEFAULT '',
    "imprintExtraDe" VARCHAR(4000) NOT NULL DEFAULT '',
    "privacyEn" VARCHAR(30000) NOT NULL DEFAULT '',
    "privacyDe" VARCHAR(30000) NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSettings_pkey" PRIMARY KEY ("id")
);


-- Hand-added: singleton row.
ALTER TABLE "LegalSettings" ADD CONSTRAINT "LegalSettings_singleton" CHECK ("id" = 1);
