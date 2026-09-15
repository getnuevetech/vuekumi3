-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'model';

-- CreateEnum
CREATE TYPE "ModelAppearanceStatus" AS ENUM ('identified', 'invited', 'claimed', 'approved', 'rejected');
CREATE TYPE "ModelUsagePreference" AS ENUM ('none', 'editorial', 'commercial');

-- CreateTable
CREATE TABLE "ModelProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "location" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelProfile_userId_key" ON "ModelProfile"("userId");
CREATE UNIQUE INDEX "ModelProfile_handle_key" ON "ModelProfile"("handle");
ALTER TABLE "ModelProfile" ADD CONSTRAINT "ModelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PhotoAppearance" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "inviteEmail" TEXT NOT NULL,
    "modelUserId" TEXT,
    "invitedById" TEXT NOT NULL,
    "status" "ModelAppearanceStatus" NOT NULL DEFAULT 'identified',
    "usage" "ModelUsagePreference" NOT NULL DEFAULT 'none',
    "confirmedLikeness" BOOLEAN NOT NULL DEFAULT false,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAppearance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoAppearance_inviteTokenHash_key" ON "PhotoAppearance"("inviteTokenHash");
CREATE UNIQUE INDEX "PhotoAppearance_photoId_inviteEmail_key" ON "PhotoAppearance"("photoId", "inviteEmail");
CREATE INDEX "PhotoAppearance_photoId_idx" ON "PhotoAppearance"("photoId");
CREATE INDEX "PhotoAppearance_modelUserId_idx" ON "PhotoAppearance"("modelUserId");
CREATE INDEX "PhotoAppearance_inviteEmail_idx" ON "PhotoAppearance"("inviteEmail");
CREATE INDEX "PhotoAppearance_status_idx" ON "PhotoAppearance"("status");
ALTER TABLE "PhotoAppearance" ADD CONSTRAINT "PhotoAppearance_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoAppearance" ADD CONSTRAINT "PhotoAppearance_modelUserId_fkey" FOREIGN KEY ("modelUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoAppearance" ADD CONSTRAINT "PhotoAppearance_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
