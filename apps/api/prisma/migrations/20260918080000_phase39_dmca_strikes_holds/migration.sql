-- AlterTable
ALTER TABLE "User" ADD COLUMN "rightsStrikeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "repeatInfringerAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EarningsLedger" ADD COLUMN "holdReason" TEXT;
ALTER TABLE "EarningsLedger" ADD COLUMN "heldAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "DmcaNoticeStatus" AS ENUM ('received', 'processing', 'waiting_counter', 'counter_received', 'waiting_restore', 'restored', 'rejected', 'closed');

-- CreateEnum
CREATE TYPE "RightsStrikeReason" AS ENUM ('fake_release', 'fake_photographer', 'false_creation_claim', 'upheld_copyright_fraud', 'upheld_likeness_fraud');

-- CreateTable
CREATE TABLE "DmcaNotice" (
    "id" TEXT NOT NULL,
    "photoId" TEXT,
    "photoUrl" TEXT,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantAddress" TEXT NOT NULL,
    "claimantPhone" TEXT,
    "workDescription" TEXT NOT NULL,
    "originalLocation" TEXT NOT NULL,
    "infringingLocation" TEXT NOT NULL,
    "goodFaith" BOOLEAN NOT NULL DEFAULT true,
    "perjury" BOOLEAN NOT NULL DEFAULT true,
    "signature" TEXT NOT NULL,
    "status" "DmcaNoticeStatus" NOT NULL DEFAULT 'received',
    "restoreEligibleAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "staffNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmcaNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmcaCounterNotice" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "senderPhone" TEXT,
    "statement" TEXT NOT NULL,
    "consentToJurisdiction" BOOLEAN NOT NULL DEFAULT true,
    "perjury" BOOLEAN NOT NULL DEFAULT true,
    "signature" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmcaCounterNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RightsStrike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "RightsStrikeReason" NOT NULL,
    "photoId" TEXT,
    "noticeId" TEXT,
    "notes" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RightsStrike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DmcaCounterNotice_noticeId_key" ON "DmcaCounterNotice"("noticeId");

-- CreateIndex
CREATE INDEX "DmcaNotice_photoId_idx" ON "DmcaNotice"("photoId");

-- CreateIndex
CREATE INDEX "DmcaNotice_status_idx" ON "DmcaNotice"("status");

-- CreateIndex
CREATE INDEX "DmcaNotice_createdAt_idx" ON "DmcaNotice"("createdAt");

-- CreateIndex
CREATE INDEX "RightsStrike_userId_idx" ON "RightsStrike"("userId");

-- CreateIndex
CREATE INDEX "RightsStrike_photoId_idx" ON "RightsStrike"("photoId");

-- CreateIndex
CREATE INDEX "RightsStrike_createdAt_idx" ON "RightsStrike"("createdAt");

-- AddForeignKey
ALTER TABLE "DmcaNotice" ADD CONSTRAINT "DmcaNotice_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmcaNotice" ADD CONSTRAINT "DmcaNotice_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmcaCounterNotice" ADD CONSTRAINT "DmcaCounterNotice_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "DmcaNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsStrike" ADD CONSTRAINT "RightsStrike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsStrike" ADD CONSTRAINT "RightsStrike_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsStrike" ADD CONSTRAINT "RightsStrike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
