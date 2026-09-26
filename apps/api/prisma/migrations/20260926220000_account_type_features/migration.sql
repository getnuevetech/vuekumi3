ALTER TABLE "BuyerPlan" ADD COLUMN "featureKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "AccountTypeConfig" (
    "accountType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTypeConfig_pkey" PRIMARY KEY ("accountType")
);
