-- Phase 62: perceptual hash for duplicate quarantine. Not biometric.
ALTER TABLE "Photo" ADD COLUMN "contentHash" TEXT;
CREATE INDEX "Photo_contentHash_idx" ON "Photo"("contentHash");
