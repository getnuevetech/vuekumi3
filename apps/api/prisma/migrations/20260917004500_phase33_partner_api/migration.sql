-- CreateEnum
CREATE TYPE "PartnerKeyStatus" AS ENUM ('active', 'revoked');

-- CreateTable
CREATE TABLE "PartnerApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "status" "PartnerKeyStatus" NOT NULL DEFAULT 'active',
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApiKey_keyHash_key" ON "PartnerApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "PartnerApiKey_status_idx" ON "PartnerApiKey"("status");

-- AddForeignKey
ALTER TABLE "PartnerApiKey" ADD CONSTRAINT "PartnerApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
