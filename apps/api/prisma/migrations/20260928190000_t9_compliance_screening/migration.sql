-- T9: provider-neutral compliance screening evidence + country-matrix provider slots (flag OFF).
-- No watchlist dumps, OFAC list payloads, or inventing a KYC vendor.

CREATE TYPE "ComplianceScreeningResult" AS ENUM ('pending', 'clear', 'match', 'inconclusive', 'unavailable');
CREATE TYPE "ComplianceSubjectType" AS ENUM ('person', 'entity', 'beneficial_owner', 'financial_institution');
CREATE TYPE "ComplianceScreeningFunction" AS ENUM ('person', 'entity', 'beneficial_owner', 'fi', 'ofac_sop');

CREATE TABLE "ComplianceScreeningEvidence" (
  "id" TEXT NOT NULL,
  "screeningId" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "subjectType" "ComplianceSubjectType" NOT NULL,
  "subjectUserId" TEXT,
  "recordedById" TEXT,
  "countryCode" TEXT,
  "result" "ComplianceScreeningResult" NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "screenedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceScreeningEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceScreeningEvidence_vendor_screeningId_key"
  ON "ComplianceScreeningEvidence"("vendor", "screeningId");
CREATE INDEX "ComplianceScreeningEvidence_subjectUserId_idx" ON "ComplianceScreeningEvidence"("subjectUserId");
CREATE INDEX "ComplianceScreeningEvidence_countryCode_idx" ON "ComplianceScreeningEvidence"("countryCode");
CREATE INDEX "ComplianceScreeningEvidence_result_idx" ON "ComplianceScreeningEvidence"("result");
CREATE INDEX "ComplianceScreeningEvidence_screenedAt_idx" ON "ComplianceScreeningEvidence"("screenedAt");

ALTER TABLE "ComplianceScreeningEvidence" ADD CONSTRAINT "ComplianceScreeningEvidence_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceScreeningEvidence" ADD CONSTRAINT "ComplianceScreeningEvidence_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceScreeningEvidence" ADD CONSTRAINT "ComplianceScreeningEvidence_countryCode_fkey"
  FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CountryScreeningProviderSlot" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "screeningFunction" "ComplianceScreeningFunction" NOT NULL,
  "providerSlug" TEXT,
  "evidenceUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CountryScreeningProviderSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CountryScreeningProviderSlot_countryCode_screeningFunction_key"
  ON "CountryScreeningProviderSlot"("countryCode", "screeningFunction");
CREATE INDEX "CountryScreeningProviderSlot_screeningFunction_idx" ON "CountryScreeningProviderSlot"("screeningFunction");

ALTER TABLE "CountryScreeningProviderSlot" ADD CONSTRAINT "CountryScreeningProviderSlot_countryCode_fkey"
  FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
