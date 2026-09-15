-- CreateEnum
CREATE TYPE "RightsReportReason" AS ENUM ('copyright', 'likeness', 'unauthorized_use', 'other');

-- CreateEnum
CREATE TYPE "RightsReportStatus" AS ENUM ('open', 'reviewing', 'dismissed', 'resolved');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "commercialLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Photo" ADD COLUMN "commercialLockedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN "commercialLockedById" TEXT;

-- CreateTable
CREATE TABLE "RightsReport" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "reason" "RightsReportReason" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "RightsReportStatus" NOT NULL DEFAULT 'open',
    "reporterUserId" TEXT,
    "reporterEmail" TEXT,
    "reporterName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RightsReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RightsReport_photoId_idx" ON "RightsReport"("photoId");
CREATE INDEX "RightsReport_status_idx" ON "RightsReport"("status");
CREATE INDEX "RightsReport_createdAt_idx" ON "RightsReport"("createdAt");
CREATE INDEX "Photo_commercialLocked_idx" ON "Photo"("commercialLocked");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_commercialLockedById_fkey" FOREIGN KEY ("commercialLockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RightsReport" ADD CONSTRAINT "RightsReport_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RightsReport" ADD CONSTRAINT "RightsReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RightsReport" ADD CONSTRAINT "RightsReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
