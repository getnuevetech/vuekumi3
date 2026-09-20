-- Phase 51 / T2: rights-ops SOP fields on RightsReport (preserve / notify / escalate).

ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "sopStage" TEXT NOT NULL DEFAULT 'intake';
ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "evidencePreservedAt" TIMESTAMP(3);
ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "evidenceNotes" TEXT;
ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "escalateTo" TEXT;
ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RightsReport_sopStage_idx" ON "RightsReport"("sopStage");
