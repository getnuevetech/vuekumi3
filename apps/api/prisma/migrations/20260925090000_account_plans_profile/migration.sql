-- Plans belong to one account audience. Downgrade settlement, cancellation
-- reasons, and per-account profile requirements are admin settings.

ALTER TABLE "BuyerPlan" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'buyer';
ALTER TABLE "UserProfile" ADD COLUMN "planAudience" TEXT NOT NULL DEFAULT 'buyer';

ALTER TABLE "User" ADD COLUMN "phoneCountryCode" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "addressLine" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "location" TEXT;

CREATE TABLE "PlanPolicy" (
  "id" TEXT NOT NULL,
  "downgradeMode" TEXT NOT NULL DEFAULT 'neither',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionCancellation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionCancellation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionCancellation_createdAt_idx" ON "SubscriptionCancellation"("createdAt");

CREATE TABLE "PlanAdjustment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fromPlan" TEXT NOT NULL,
  "toPlan" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "creditUsd" DOUBLE PRECISION NOT NULL,
  "chargeUsd" DOUBLE PRECISION NOT NULL,
  "refundUsd" DOUBLE PRECISION NOT NULL,
  "refundStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanAdjustment_userId_idx" ON "PlanAdjustment"("userId");

CREATE TABLE "ProfileRequirement" (
  "accountType" TEXT NOT NULL,
  "fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileRequirement_pkey" PRIMARY KEY ("accountType")
);
