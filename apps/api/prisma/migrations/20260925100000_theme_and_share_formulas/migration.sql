-- Appearance preference and contributor payout formulas.
-- Default group rows stay at 50% of the sale, matching payments.contributor_share.

ALTER TABLE "User" ADD COLUMN "theme" TEXT;

CREATE TABLE "ShareFormula" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "groupKey" TEXT,
  "userId" TEXT,
  "mode" TEXT NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "fixedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShareFormula_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShareFormula_scope_groupKey_key" ON "ShareFormula"("scope", "groupKey");
CREATE UNIQUE INDEX "ShareFormula_userId_key" ON "ShareFormula"("userId");
CREATE INDEX "ShareFormula_scope_idx" ON "ShareFormula"("scope");

ALTER TABLE "ShareFormula" ADD CONSTRAINT "ShareFormula_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ShareFormula" ("id", "scope", "groupKey", "mode", "percent", "fixedUsd", "updatedAt")
VALUES
  ('share_group_photographer', 'group', 'photographer', 'percentage', 50, 0, CURRENT_TIMESTAMP),
  ('share_group_photo_influencer', 'group', 'photo_influencer', 'percentage', 50, 0, CURRENT_TIMESTAMP),
  ('share_group_contributor', 'group', 'contributor', 'percentage', 50, 0, CURRENT_TIMESTAMP);
