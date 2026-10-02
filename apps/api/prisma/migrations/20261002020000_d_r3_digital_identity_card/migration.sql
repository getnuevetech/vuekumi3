-- D-R3 public Digital ID cards (not KYC / not biometrics).
CREATE TABLE "DigitalIdentityCard" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalIdentityCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigitalIdentityCard_publicToken_key" ON "DigitalIdentityCard"("publicToken");
CREATE INDEX "DigitalIdentityCard_profileId_cardType_idx" ON "DigitalIdentityCard"("profileId", "cardType");
CREATE INDEX "DigitalIdentityCard_status_idx" ON "DigitalIdentityCard"("status");
