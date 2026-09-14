-- CreateTable
CREATE TABLE "AgencyInvite" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "agencyRole" "AgencyRole" NOT NULL DEFAULT 'member',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyInvite_tokenHash_key" ON "AgencyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AgencyInvite_agencyId_idx" ON "AgencyInvite"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyInvite_email_idx" ON "AgencyInvite"("email");

-- CreateIndex
CREATE INDEX "LicenseQuote_agencyId_idx" ON "LicenseQuote"("agencyId");

-- CreateIndex
CREATE INDEX "LicenseGrant_agencyId_idx" ON "LicenseGrant"("agencyId");

-- AddForeignKey
ALTER TABLE "AgencyInvite" ADD CONSTRAINT "AgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyInvite" ADD CONSTRAINT "AgencyInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
