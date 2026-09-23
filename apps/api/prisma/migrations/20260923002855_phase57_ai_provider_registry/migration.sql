-- Phase 57 — AI Provider Registry: make AiProvider.purpose dispatchable.
-- priority orders multiple providers registered for the same purpose
-- (lowest wins), so admins can register a fallback without deleting the
-- primary provider.

-- AlterTable
ALTER TABLE "AiProvider" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AiProvider_purpose_enabled_priority_idx" ON "AiProvider"("purpose", "enabled", "priority");
