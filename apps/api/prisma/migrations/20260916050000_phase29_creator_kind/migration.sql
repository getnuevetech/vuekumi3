-- CreateEnum
CREATE TYPE "CreatorKind" AS ENUM ('photographer', 'photo_influencer');

-- AlterTable
ALTER TABLE "ContributorProfile" ADD COLUMN "creatorKind" "CreatorKind" NOT NULL DEFAULT 'photographer';
