-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "plusUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'plus',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "amountLocal" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "checkoutUrl" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerRef_key" ON "Subscription"("providerRef");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
