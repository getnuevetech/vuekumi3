-- Phase 60 / Dec-Bio: provider-neutral identity verification evidence (flag OFF).
-- No biometric templates, embeddings, or raw imagery columns.

CREATE TYPE "IdentityVerificationResult" AS ENUM ('pending', 'passed', 'failed', 'inconclusive', 'unavailable');
CREATE TYPE "IdentityManualReviewStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');
CREATE TYPE "SubjectMatchResult" AS ENUM ('not_run', 'matched', 'not_matched', 'inconclusive', 'unavailable');

CREATE TABLE "IdentityVerificationEvidence" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "verifiedPersonId" TEXT,
  "subjectUserId" TEXT,
  "recordedById" TEXT,
  "photoId" TEXT,
  "appearanceId" TEXT,
  "result" "IdentityVerificationResult" NOT NULL DEFAULT 'pending',
  "manualReviewStatus" "IdentityManualReviewStatus" NOT NULL DEFAULT 'not_required',
  "consentVersion" TEXT,
  "documentCountry" TEXT,
  "documentType" TEXT,
  "subjectMatchResult" "SubjectMatchResult" NOT NULL DEFAULT 'not_run',
  "relatedImageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdentityVerificationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityVerificationEvidence_vendor_verificationId_key"
  ON "IdentityVerificationEvidence"("vendor", "verificationId");
CREATE INDEX "IdentityVerificationEvidence_subjectUserId_idx" ON "IdentityVerificationEvidence"("subjectUserId");
CREATE INDEX "IdentityVerificationEvidence_photoId_idx" ON "IdentityVerificationEvidence"("photoId");
CREATE INDEX "IdentityVerificationEvidence_appearanceId_idx" ON "IdentityVerificationEvidence"("appearanceId");
CREATE INDEX "IdentityVerificationEvidence_result_idx" ON "IdentityVerificationEvidence"("result");
CREATE INDEX "IdentityVerificationEvidence_verifiedAt_idx" ON "IdentityVerificationEvidence"("verifiedAt");

ALTER TABLE "IdentityVerificationEvidence" ADD CONSTRAINT "IdentityVerificationEvidence_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdentityVerificationEvidence" ADD CONSTRAINT "IdentityVerificationEvidence_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdentityVerificationEvidence" ADD CONSTRAINT "IdentityVerificationEvidence_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdentityVerificationEvidence" ADD CONSTRAINT "IdentityVerificationEvidence_appearanceId_fkey"
  FOREIGN KEY ("appearanceId") REFERENCES "PhotoAppearance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
