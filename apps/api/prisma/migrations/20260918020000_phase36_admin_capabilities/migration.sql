-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AdminProfile" ADD COLUMN "capabilitiesCustomized" BOOLEAN NOT NULL DEFAULT false;
