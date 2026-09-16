-- CreateEnum
CREATE TYPE "RepresentationStatus" AS ENUM ('requested', 'represented', 'declined', 'ended', 'withdrawn');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('new', 'answered', 'closed');

-- CreateTable
CREATE TABLE "Representation" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "status" "RepresentationStatus" NOT NULL DEFAULT 'requested',
    "note" TEXT,
    "staffNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Representation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepresentationInquiry" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "requesterId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'new',
    "staffNote" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepresentationInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Representation_contributorId_key" ON "Representation"("contributorId");

-- CreateIndex
CREATE INDEX "Representation_status_idx" ON "Representation"("status");

-- CreateIndex
CREATE INDEX "RepresentationInquiry_status_idx" ON "RepresentationInquiry"("status");

-- CreateIndex
CREATE INDEX "RepresentationInquiry_photoId_idx" ON "RepresentationInquiry"("photoId");

-- AddForeignKey
ALTER TABLE "Representation" ADD CONSTRAINT "Representation_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationInquiry" ADD CONSTRAINT "RepresentationInquiry_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentationInquiry" ADD CONSTRAINT "RepresentationInquiry_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
