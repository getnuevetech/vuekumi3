-- Imagery Concept v2.0 reconciliation foundation:
-- library tiers, commercial status, RevenuePolicy, OpenDownloadEvent, grant stamps.

CREATE TYPE "LibraryTier" AS ENUM ('OPEN', 'LICENSED', 'VERIFIED_PLUS', 'EDITORIAL', 'PRIVATE');
CREATE TYPE "CommercialStatus" AS ENUM ('ENABLED', 'BLOCKED', 'SUSPENDED');

ALTER TABLE "Photo" ADD COLUMN "libraryTier" "LibraryTier" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Photo" ADD COLUMN "commercialStatus" "CommercialStatus" NOT NULL DEFAULT 'ENABLED';

-- Backfill placement from legacy license / permission axes.
UPDATE "Photo" SET "libraryTier" = 'LICENSED' WHERE "licenseType" = 'premium';
UPDATE "Photo" SET "libraryTier" = 'EDITORIAL' WHERE "permissionState" = 'editorial';
UPDATE "Photo" SET "libraryTier" = 'PRIVATE' WHERE "permissionState" IN ('private', 'portfolio');
UPDATE "Photo" SET "commercialStatus" = 'BLOCKED' WHERE "commercialLocked" = true;

CREATE TABLE "RevenuePolicy" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "platformShareRule" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "creatorPoolRule" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "refundRule" TEXT NOT NULL DEFAULT 'net_after_refunds',
  "taxRule" TEXT NOT NULL DEFAULT 'exclude_vat_from_base',
  "processingFeeRule" TEXT NOT NULL DEFAULT 'before_recipient_fees',
  "licenseType" TEXT NOT NULL DEFAULT 'all',
  "current" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RevenuePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenuePolicy_policyId_version_key" ON "RevenuePolicy"("policyId", "version");
CREATE INDEX "RevenuePolicy_current_idx" ON "RevenuePolicy"("current");
CREATE INDEX "RevenuePolicy_effectiveFrom_idx" ON "RevenuePolicy"("effectiveFrom");

INSERT INTO "RevenuePolicy" (
  "id", "policyId", "version", "platformShareRule", "creatorPoolRule",
  "current", "notes", "updatedAt"
) VALUES (
  'rp_2026_001_v1', 'RP-2026-001', 1, 0.5, 0.5,
  true, 'Initial policy mirroring legacy 50/50 photographer ledger. Rates are versioned and not permanent.', CURRENT_TIMESTAMP
);

CREATE TABLE "OpenDownloadEvent" (
  "id" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "imageVersion" TEXT,
  "openLicenseVersion" TEXT NOT NULL,
  "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileVariant" TEXT NOT NULL DEFAULT 'preview',
  "source" TEXT,
  "referrer" TEXT,
  "countryRegion" TEXT,
  "anonymousSessionId" TEXT,
  "ipHash" TEXT,
  CONSTRAINT "OpenDownloadEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpenDownloadEvent_imageId_idx" ON "OpenDownloadEvent"("imageId");
CREATE INDEX "OpenDownloadEvent_downloadedAt_idx" ON "OpenDownloadEvent"("downloadedAt");
CREATE INDEX "OpenDownloadEvent_openLicenseVersion_idx" ON "OpenDownloadEvent"("openLicenseVersion");
CREATE INDEX "OpenDownloadEvent_anonymousSessionId_idx" ON "OpenDownloadEvent"("anonymousSessionId");

ALTER TABLE "OpenDownloadEvent" ADD CONSTRAINT "OpenDownloadEvent_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LicenseGrant" ADD COLUMN "revenuePolicyId" TEXT;
ALTER TABLE "LicenseGrant" ADD COLUMN "revenuePolicyVersion" INTEGER;
ALTER TABLE "LicenseGrant" ADD COLUMN "platformShareUsd" DOUBLE PRECISION;
ALTER TABLE "LicenseGrant" ADD COLUMN "creatorPoolUsd" DOUBLE PRECISION;

ALTER TABLE "EarningsLedger" ADD COLUMN "revenuePolicyId" TEXT;
ALTER TABLE "EarningsLedger" ADD COLUMN "revenuePolicyVersion" INTEGER;

CREATE INDEX "Photo_libraryTier_idx" ON "Photo"("libraryTier");
CREATE INDEX "Photo_commercialStatus_idx" ON "Photo"("commercialStatus");

-- ShareFormula now applies within the creator pool (RevenuePolicy handles platform cut).
-- Legacy 50% of sale group defaults become 100% of the creator pool.
UPDATE "ShareFormula"
SET "percent" = 100, "updatedAt" = CURRENT_TIMESTAMP
WHERE "scope" = 'group' AND "mode" = 'percentage' AND "percent" = 50;
