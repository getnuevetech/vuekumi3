-- CreateEnum
CREATE TYPE "LikenessCheckStatus" AS ENUM ('similar', 'not_similar', 'inconclusive', 'unavailable');

-- CreateTable
CREATE TABLE "LikenessCheck" (
    "id" TEXT NOT NULL,
    "appearanceId" TEXT NOT NULL,
    "modelUserId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "status" "LikenessCheckStatus" NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "comparedAt" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "referenceDeletedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikenessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LikenessCheck_appearanceId_createdAt_idx" ON "LikenessCheck"("appearanceId", "createdAt");

-- CreateIndex
CREATE INDEX "LikenessCheck_modelUserId_idx" ON "LikenessCheck"("modelUserId");

-- CreateIndex
CREATE INDEX "LikenessCheck_photoId_idx" ON "LikenessCheck"("photoId");

-- AddForeignKey
ALTER TABLE "LikenessCheck" ADD CONSTRAINT "LikenessCheck_appearanceId_fkey" FOREIGN KEY ("appearanceId") REFERENCES "PhotoAppearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LikenessCheck" ADD CONSTRAINT "LikenessCheck_modelUserId_fkey" FOREIGN KEY ("modelUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
