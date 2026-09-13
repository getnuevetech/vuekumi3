-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "contributorEligible" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "Country_region_idx" ON "Country"("region");
CREATE INDEX "Country_contributorEligible_idx" ON "Country"("contributorEligible");

CREATE TABLE "ExchangeRate" (
    "currency" TEXT NOT NULL,
    "rateToUsd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "overrideRate" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency")
);

CREATE TABLE "PaymentGateway" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "countries" TEXT[],
    "currencies" TEXT[],
    "configEnc" TEXT,
    "publicKey" TEXT,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentGateway_slug_key" ON "PaymentGateway"("slug");

CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "apiBaseUrl" TEXT,
    "apiKeyEnc" TEXT,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProvider_slug_key" ON "AiProvider"("slug");
