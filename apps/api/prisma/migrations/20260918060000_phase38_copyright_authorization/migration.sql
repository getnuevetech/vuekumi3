-- CreateTable
CREATE TABLE "CopyrightAuthorization" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "inviteEmail" TEXT,
    "inviteMobile" TEXT,
    "photographerUserId" TEXT,
    "invitedById" TEXT NOT NULL,
    "status" "ModelAppearanceStatus" NOT NULL DEFAULT 'identified',
    "decisionKind" "AppearanceDecisionKind",
    "usage" "ModelUsagePreference" NOT NULL DEFAULT 'none',
    "portfolioDisplay" BOOLEAN NOT NULL DEFAULT false,
    "commercialSublicensing" BOOLEAN NOT NULL DEFAULT false,
    "aiTraining" BOOLEAN NOT NULL DEFAULT false,
    "quality" "CopyrightStatus" NOT NULL DEFAULT 'claimed',
    "documentFileName" TEXT,
    "documentKey" TEXT,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyrightAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CopyrightAuthorization_inviteTokenHash_key" ON "CopyrightAuthorization"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "CopyrightAuthorization_photoId_idx" ON "CopyrightAuthorization"("photoId");

-- CreateIndex
CREATE INDEX "CopyrightAuthorization_photographerUserId_idx" ON "CopyrightAuthorization"("photographerUserId");

-- CreateIndex
CREATE INDEX "CopyrightAuthorization_inviteEmail_idx" ON "CopyrightAuthorization"("inviteEmail");

-- CreateIndex
CREATE INDEX "CopyrightAuthorization_status_idx" ON "CopyrightAuthorization"("status");

-- AddForeignKey
ALTER TABLE "CopyrightAuthorization" ADD CONSTRAINT "CopyrightAuthorization_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyrightAuthorization" ADD CONSTRAINT "CopyrightAuthorization_photographerUserId_fkey" FOREIGN KEY ("photographerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyrightAuthorization" ADD CONSTRAINT "CopyrightAuthorization_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
