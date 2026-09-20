-- Phase 50 / T1: public report-content taxonomy + urgency/queue routing.

ALTER TYPE "RightsReportReason" ADD VALUE IF NOT EXISTS 'fraudulent_release';
ALTER TYPE "RightsReportReason" ADD VALUE IF NOT EXISTS 'safety_urgent';
ALTER TYPE "RightsReportReason" ADD VALUE IF NOT EXISTS 'compensation_dispute';

ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "urgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RightsReport" ADD COLUMN IF NOT EXISTS "queue" TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS "RightsReport_urgent_idx" ON "RightsReport"("urgent");
CREATE INDEX IF NOT EXISTS "RightsReport_queue_idx" ON "RightsReport"("queue");
