-- AlterEnum
ALTER TYPE "CopyrightStatus" ADD VALUE 'documented';

-- CreateEnum
CREATE TYPE "CopyrightMethod" AS ENUM ('attestation', 'document', 'vuekumi_direct');

-- CreateEnum
CREATE TYPE "LikenessQuality" AS ENUM ('claimed', 'documented', 'verified');

-- CreateEnum
CREATE TYPE "CreationClaim" AS ENUM ('self_created', 'photographer_took', 'assigned', 'licensed', 'unknown');

-- CreateEnum
CREATE TYPE "RightsLedgerActorKind" AS ENUM ('user', 'guest', 'staff', 'system');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "uploadedById" TEXT;
ALTER TABLE "Photo" ADD COLUMN "creationClaim" "CreationClaim" NOT NULL DEFAULT 'self_created';

UPDATE "Photo" SET "uploadedById" = "contributorId" WHERE "uploadedById" IS NULL;

-- AlterTable
ALTER TABLE "RightsRecord" ADD COLUMN "copyrightMethod" "CopyrightMethod" NOT NULL DEFAULT 'attestation';

UPDATE "RightsRecord" SET "copyrightMethod" = 'vuekumi_direct' WHERE "copyrightStatus" = 'verified';

-- AlterTable
ALTER TABLE "PhotoAppearance" ADD COLUMN "consentQuality" "LikenessQuality" NOT NULL DEFAULT 'claimed';

UPDATE "PhotoAppearance"
SET "consentQuality" = 'verified'
WHERE "verificationLevel" = 'vuekumi_verified' AND "consentStatus" = 'approved';

UPDATE "PhotoAppearance"
SET "consentQuality" = 'documented'
WHERE "verificationLevel" = 'photographer_provided';

-- AlterTable
ALTER TABLE "LicenseGrant" ADD COLUMN "ledgerHeadId" TEXT;
ALTER TABLE "LicenseGrant" ADD COLUMN "ledgerSnapshot" JSONB;

-- CreateTable
CREATE TABLE "RightsLedgerEvent" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorKind" "RightsLedgerActorKind" NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "agreementVersion" TEXT,
    "scopesJson" JSONB,
    "channel" TEXT,
    "relatedIdsJson" JSONB,
    "previousCopyright" "CopyrightStatus",
    "nextCopyright" "CopyrightStatus",
    "previousLikeness" "ModelConsentStatus",
    "nextLikeness" "ModelConsentStatus",
    "previousQuality" TEXT,
    "nextQuality" TEXT,
    "commercialEligible" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RightsLedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_uploadedById_idx" ON "Photo"("uploadedById");

-- CreateIndex
CREATE INDEX "RightsLedgerEvent_photoId_createdAt_idx" ON "RightsLedgerEvent"("photoId", "createdAt");

-- CreateIndex
CREATE INDEX "RightsLedgerEvent_actorId_idx" ON "RightsLedgerEvent"("actorId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsLedgerEvent" ADD CONSTRAINT "RightsLedgerEvent_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsLedgerEvent" ADD CONSTRAINT "RightsLedgerEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
