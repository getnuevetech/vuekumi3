-- P1-T8 / Dec-AfricaElig: contributor waitlist for HOLD African markets.

CREATE TABLE "ContributorWaitlist" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "countryCode" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "policyVersion" TEXT,
  "notes" TEXT,
  "promotedAt" TIMESTAMP(3),
  "promotedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributorWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributorWaitlist_userId_key" ON "ContributorWaitlist"("userId");
CREATE UNIQUE INDEX "ContributorWaitlist_email_countryCode_accountType_key"
  ON "ContributorWaitlist"("email", "countryCode", "accountType");
CREATE INDEX "ContributorWaitlist_countryCode_idx" ON "ContributorWaitlist"("countryCode");
CREATE INDEX "ContributorWaitlist_status_idx" ON "ContributorWaitlist"("status");
CREATE INDEX "ContributorWaitlist_createdAt_idx" ON "ContributorWaitlist"("createdAt");

ALTER TABLE "ContributorWaitlist" ADD CONSTRAINT "ContributorWaitlist_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContributorWaitlist" ADD CONSTRAINT "ContributorWaitlist_countryCode_fkey"
  FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
