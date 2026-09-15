-- CreateEnum
CREATE TYPE "PermissionState" AS ENUM ('private', 'portfolio', 'editorial', 'restricted', 'commercial', 'exclusive', 'agency_protected');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "permissionState" "PermissionState" NOT NULL DEFAULT 'commercial';
ALTER TABLE "Photo" ADD COLUMN "restrictionNotes" TEXT;

-- Existing exclusive opt-ins keep that state
UPDATE "Photo" SET "permissionState" = 'exclusive' WHERE "exclusiveAvailable" = true OR "exclusiveSold" = true;

-- Rights-managed must require a model release, same as other commercial grants
UPDATE "LicenseProduct" SET "requiresModelRelease" = true WHERE "type" = 'rights_managed';

-- CreateIndex
CREATE INDEX "Photo_permissionState_idx" ON "Photo"("permissionState");
