-- Phase 57: reason-coded commercial quarantine locks.

ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "commercialLockReason" TEXT;
