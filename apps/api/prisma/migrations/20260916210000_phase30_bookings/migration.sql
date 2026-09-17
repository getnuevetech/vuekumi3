-- CreateEnum
CREATE TYPE "BookingKind" AS ENUM ('photographer', 'model');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'quoted', 'accepted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "BookingAvailability" AS ENUM ('open', 'limited', 'unavailable');

-- AlterTable
ALTER TABLE "ContributorProfile" ADD COLUMN "availability" "BookingAvailability" NOT NULL DEFAULT 'open',
ADD COLUMN "dayRateUsd" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ModelProfile" ADD COLUMN "availability" "BookingAvailability" NOT NULL DEFAULT 'open',
ADD COLUMN "dayRateUsd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "kind" "BookingKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetUsd" DOUBLE PRECISION,
    "quoteUsd" DOUBLE PRECISION,
    "quoteNote" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingRequest_targetId_status_idx" ON "BookingRequest"("targetId", "status");

-- CreateIndex
CREATE INDEX "BookingRequest_requesterId_idx" ON "BookingRequest"("requesterId");

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
