-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "deliverables" TEXT,
    "usage" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetUsd" DOUBLE PRECISION,
    "status" "CampaignStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPitch" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "rateUsd" DOUBLE PRECISION,
    "status" "PitchStatus" NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignPitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignPitch_campaignId_contributorId_key" ON "CampaignPitch"("campaignId", "contributorId");

-- CreateIndex
CREATE INDEX "CampaignPitch_contributorId_idx" ON "CampaignPitch"("contributorId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPitch" ADD CONSTRAINT "CampaignPitch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPitch" ADD CONSTRAINT "CampaignPitch_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
