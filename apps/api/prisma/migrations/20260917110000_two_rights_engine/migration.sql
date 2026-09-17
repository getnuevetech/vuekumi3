-- CreateEnum
CREATE TYPE "CopyrightStatus" AS ENUM ('claimed', 'verified', 'disputed', 'restricted');

-- CreateEnum
CREATE TYPE "ModelConsentStatus" AS ENUM ('not_required', 'required', 'invitation_sent', 'pending', 'approved', 'rejected', 'revoked', 'disputed');

-- CreateEnum
CREATE TYPE "ReleaseVerificationLevel" AS ENUM ('photographer_provided', 'vuekumi_verified');

-- CreateEnum
CREATE TYPE "AppearanceDecisionKind" AS ENUM ('approved', 'rejected', 'not_me', 'unauthorized');

-- CreateEnum
CREATE TYPE "SubjectAgeClass" AS ENUM ('unknown', 'adult', 'minor');

-- CreateEnum
CREATE TYPE "RightsScreeningKind" AS ENUM ('no_recognizable_person', 'one_recognizable_person', 'multiple_recognizable_people', 'crowd_background_persons', 'uncertain_human_detection');

-- AlterTable User: existing commercial photographers become the photographer type
UPDATE "User" SET "accountType" = 'photographer' WHERE "accountType" = 'contributor';

-- CreateTable
CREATE TABLE "PhotoShoot" (
    "id" TEXT NOT NULL,
    "photographerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shotOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoShoot_pkey" PRIMARY KEY ("id")
);

-- AlterTable Photo
ALTER TABLE "Photo"
  ADD COLUMN "shootId" TEXT,
  ADD COLUMN "screeningKind" "RightsScreeningKind",
  ADD COLUMN "screeningPeopleCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "possibleMinor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "crowdBackground" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selfPortraitLikely" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "potentiallySensitive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "uncertainHumanDetection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "screeningNotes" TEXT,
  ADD COLUMN "screeningAt" TIMESTAMP(3),
  ADD COLUMN "screeningProvider" TEXT;

UPDATE "Photo"
SET
  "screeningKind" = CASE WHEN "hasRecognizablePeople" THEN 'one_recognizable_person'::"RightsScreeningKind" ELSE 'no_recognizable_person'::"RightsScreeningKind" END,
  "screeningPeopleCount" = CASE WHEN "hasRecognizablePeople" THEN 1 ELSE 0 END,
  "screeningAt" = "createdAt",
  "screeningProvider" = 'dev';

-- AlterTable RightsRecord
ALTER TABLE "RightsRecord"
  ADD COLUMN "copyrightStatus" "CopyrightStatus" NOT NULL DEFAULT 'claimed',
  ADD COLUMN "copyrightAttestedAt" TIMESTAMP(3),
  ADD COLUMN "modelConsentStatus" "ModelConsentStatus" NOT NULL DEFAULT 'not_required',
  ADD COLUMN "commercialEligible" BOOLEAN NOT NULL DEFAULT false;

UPDATE "RightsRecord"
SET
  "copyrightStatus" = CASE WHEN "copyrightVerified" THEN 'verified'::"CopyrightStatus" ELSE 'claimed'::"CopyrightStatus" END,
  "copyrightAttestedAt" = "createdAt",
  "modelConsentStatus" = CASE WHEN "modelReleaseRequired" THEN 'required'::"ModelConsentStatus" ELSE 'not_required'::"ModelConsentStatus" END;

-- AlterTable ModelRelease
ALTER TABLE "ModelRelease"
  ADD COLUMN "photographerId" TEXT,
  ADD COLUMN "appearanceId" TEXT,
  ADD COLUMN "verificationLevel" "ReleaseVerificationLevel" NOT NULL DEFAULT 'photographer_provided',
  ADD COLUMN "attestedGenuine" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attestedAt" TIMESTAMP(3),
  ADD COLUMN "modelIdentity" TEXT,
  ADD COLUMN "confirmationSentAt" TIMESTAMP(3),
  ADD COLUMN "modelConfirmedAt" TIMESTAMP(3);

UPDATE "ModelRelease" AS mr
SET "photographerId" = p."contributorId"
FROM "Photo" AS p
WHERE p.id = mr."photoId";

UPDATE "ModelRelease"
SET "verificationLevel" = 'vuekumi_verified'
WHERE "status" = 'verified';

-- AlterTable PhotoAppearance
DROP INDEX IF EXISTS "PhotoAppearance_photoId_inviteEmail_key";

ALTER TABLE "PhotoAppearance"
  ALTER COLUMN "inviteEmail" DROP NOT NULL,
  ADD COLUMN "inviteMobile" TEXT,
  ADD COLUMN "consentStatus" "ModelConsentStatus" NOT NULL DEFAULT 'required',
  ADD COLUMN "decisionKind" "AppearanceDecisionKind",
  ADD COLUMN "ageClass" "SubjectAgeClass" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "isMinor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guardianName" TEXT,
  ADD COLUMN "guardianEmail" TEXT,
  ADD COLUMN "guardianMobile" TEXT,
  ADD COLUMN "guardianAuthorizedAt" TIMESTAMP(3),
  ADD COLUMN "verificationLevel" "ReleaseVerificationLevel";

UPDATE "PhotoAppearance"
SET
  "consentStatus" = CASE "status"
    WHEN 'approved' THEN 'approved'::"ModelConsentStatus"
    WHEN 'rejected' THEN 'rejected'::"ModelConsentStatus"
    WHEN 'claimed' THEN 'pending'::"ModelConsentStatus"
    WHEN 'invited' THEN 'invitation_sent'::"ModelConsentStatus"
    ELSE 'required'::"ModelConsentStatus"
  END,
  "decisionKind" = CASE "status"
    WHEN 'approved' THEN 'approved'::"AppearanceDecisionKind"
    WHEN 'rejected' THEN 'rejected'::"AppearanceDecisionKind"
    ELSE NULL
  END,
  "ageClass" = 'adult';

UPDATE "RightsRecord" AS r
SET "modelConsentStatus" = 'approved'
WHERE r."photoId" IN (
  SELECT p.id FROM "Photo" p
  WHERE p."hasRecognizablePeople" = true
    AND EXISTS (SELECT 1 FROM "PhotoAppearance" a WHERE a."photoId" = p.id)
    AND NOT EXISTS (
      SELECT 1 FROM "PhotoAppearance" a
      WHERE a."photoId" = p.id AND a."consentStatus" <> 'approved'
    )
);

UPDATE "RightsRecord"
SET "commercialEligible" = (
  "copyrightStatus" IN ('claimed', 'verified')
  AND "modelConsentStatus" IN ('not_required', 'approved')
);

-- CreateIndex
CREATE INDEX "Photo_shootId_idx" ON "Photo"("shootId");

CREATE INDEX "PhotoShoot_photographerId_idx" ON "PhotoShoot"("photographerId");

CREATE INDEX "ModelRelease_photographerId_idx" ON "ModelRelease"("photographerId");

CREATE INDEX "ModelRelease_appearanceId_idx" ON "ModelRelease"("appearanceId");

CREATE INDEX "PhotoAppearance_consentStatus_idx" ON "PhotoAppearance"("consentStatus");

-- AddForeignKey
ALTER TABLE "PhotoShoot" ADD CONSTRAINT "PhotoShoot_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_shootId_fkey" FOREIGN KEY ("shootId") REFERENCES "PhotoShoot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelRelease" ADD CONSTRAINT "ModelRelease_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelRelease" ADD CONSTRAINT "ModelRelease_appearanceId_fkey" FOREIGN KEY ("appearanceId") REFERENCES "PhotoAppearance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
