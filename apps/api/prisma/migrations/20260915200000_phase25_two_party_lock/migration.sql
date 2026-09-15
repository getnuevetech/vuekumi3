-- AlterTable
ALTER TABLE "RightsRecord" ADD COLUMN "processVerifiedAt" TIMESTAMP(3);
ALTER TABLE "RightsRecord" ADD COLUMN "processVerifiedById" TEXT;
ALTER TABLE "RightsRecord" ADD COLUMN "consentVersion" TEXT;

-- AlterTable
ALTER TABLE "PhotoAppearance" ADD COLUMN "consentVersion" TEXT;

-- AddForeignKey
ALTER TABLE "RightsRecord" ADD CONSTRAINT "RightsRecord_processVerifiedById_fkey" FOREIGN KEY ("processVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
