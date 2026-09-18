-- AlterEnum
ALTER TYPE "AppearanceDecisionKind" ADD VALUE 'revoked';
ALTER TYPE "ModelAppearanceStatus" ADD VALUE 'revoked';

-- AlterTable
ALTER TABLE "LicenseGrant" ADD COLUMN "agreementKind" TEXT;
ALTER TABLE "LicenseGrant" ADD COLUMN "agreementVersion" TEXT;

-- AlterTable
ALTER TABLE "AgreementVersion" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'photographer';
ALTER TABLE "AgreementVersion" ADD COLUMN "counselStatus" TEXT NOT NULL DEFAULT 'placeholder';

CREATE INDEX IF NOT EXISTS "AgreementVersion_kind_idx" ON "AgreementVersion"("kind");

-- CreateTable
CREATE TABLE "LegalOverlay" (
    "countryCode" TEXT NOT NULL,
    "overlayKind" TEXT NOT NULL,
    "contributorAllowed" BOOLEAN NOT NULL,
    "dataTransferNotice" TEXT NOT NULL,
    "commissionedPhotoPrompt" TEXT NOT NULL,
    "extraNotice" TEXT,
    "biometricForbidden" BOOLEAN NOT NULL DEFAULT true,
    "counselStatus" TEXT NOT NULL DEFAULT 'placeholder',
    "lawLabel" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalOverlay_pkey" PRIMARY KEY ("countryCode")
);

CREATE INDEX "LegalOverlay_overlayKind_idx" ON "LegalOverlay"("overlayKind");

ALTER TABLE "LegalOverlay" ADD CONSTRAINT "LegalOverlay_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
