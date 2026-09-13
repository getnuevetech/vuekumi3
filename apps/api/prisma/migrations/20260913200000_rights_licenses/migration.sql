-- CreateEnum
CREATE TYPE "GrantLicenseType" AS ENUM ('royalty_free', 'commercial', 'extended', 'editorial', 'rights_managed', 'exclusive');

-- CreateEnum
CREATE TYPE "ModelReleaseStatus" AS ENUM ('not_required', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('pending', 'quoted', 'accepted', 'declined');

-- AlterTable Photo
ALTER TABLE "Photo" ADD COLUMN "exclusiveSold" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable RightsRecord
ALTER TABLE "RightsRecord" ADD COLUMN "copyrightHolder" TEXT;
ALTER TABLE "RightsRecord" ALTER COLUMN "modelReleaseStatus" DROP DEFAULT;
ALTER TABLE "RightsRecord" ALTER COLUMN "modelReleaseStatus" TYPE "ModelReleaseStatus" USING "modelReleaseStatus"::"ModelReleaseStatus";
ALTER TABLE "RightsRecord" ALTER COLUMN "modelReleaseStatus" SET DEFAULT 'not_required';

-- CreateTable
CREATE TABLE "ModelRelease" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ModelReleaseStatus" NOT NULL DEFAULT 'pending',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseProduct" (
    "id" TEXT NOT NULL,
    "type" "GrantLicenseType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" TEXT[],
    "commercialAllowed" BOOLEAN NOT NULL DEFAULT true,
    "requiresModelRelease" BOOLEAN NOT NULL DEFAULT false,
    "agencyPreferred" BOOLEAN NOT NULL DEFAULT false,
    "quoteOnly" BOOLEAN NOT NULL DEFAULT false,
    "exclusiveOptIn" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LicenseProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseQuote" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "agencyId" TEXT,
    "productId" TEXT NOT NULL,
    "territory" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "channels" TEXT NOT NULL,
    "notes" TEXT,
    "quoteUsd" DOUBLE PRECISION,
    "status" "QuoteStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseGrant" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "agencyId" TEXT,
    "quoteId" TEXT,
    "licenseType" "GrantLicenseType" NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountLocal" DOUBLE PRECISION NOT NULL,
    "scopeJson" JSONB NOT NULL,
    "certificateCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementVersion" (
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementVersion_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
CREATE INDEX "ModelRelease_photoId_idx" ON "ModelRelease"("photoId");

-- CreateIndex
CREATE INDEX "ModelRelease_status_idx" ON "ModelRelease"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseProduct_type_key" ON "LicenseProduct"("type");

-- CreateIndex
CREATE INDEX "LicenseQuote_photoId_idx" ON "LicenseQuote"("photoId");

-- CreateIndex
CREATE INDEX "LicenseQuote_requesterId_idx" ON "LicenseQuote"("requesterId");

-- CreateIndex
CREATE INDEX "LicenseQuote_status_idx" ON "LicenseQuote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseGrant_quoteId_key" ON "LicenseGrant"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseGrant_certificateCode_key" ON "LicenseGrant"("certificateCode");

-- CreateIndex
CREATE INDEX "LicenseGrant_buyerId_idx" ON "LicenseGrant"("buyerId");

-- CreateIndex
CREATE INDEX "LicenseGrant_photoId_idx" ON "LicenseGrant"("photoId");

-- AddForeignKey
ALTER TABLE "ModelRelease" ADD CONSTRAINT "ModelRelease_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRelease" ADD CONSTRAINT "ModelRelease_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseQuote" ADD CONSTRAINT "LicenseQuote_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseQuote" ADD CONSTRAINT "LicenseQuote_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseQuote" ADD CONSTRAINT "LicenseQuote_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseQuote" ADD CONSTRAINT "LicenseQuote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LicenseProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LicenseProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "LicenseQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
