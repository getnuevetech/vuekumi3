-- Catch-up migration: schema.prisma already carried these changes (the
-- PhotoAsset.storageKey index since Phase 22; the updatedAt DROP DEFAULT
-- statements are a Prisma-engine-version artifact of @updatedAt columns)
-- but no migration file was ever generated for them. Applying them now so
-- `prisma migrate deploy` and the live schema agree before Phase 57 adds
-- its own, unrelated change.

-- AlterTable
ALTER TABLE "Collection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OAuthAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PayoutMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PhotoAsset_storageKey_idx" ON "PhotoAsset"("storageKey");
