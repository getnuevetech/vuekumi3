-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quoteId" TEXT,
    "grantId" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "amountLocal" DOUBLE PRECISION NOT NULL,
    "providerRef" TEXT,
    "checkoutUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningsLedger" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "paymentId" TEXT,
    "grantId" TEXT,
    "source" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarningsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_grantId_key" ON "Payment"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_buyerId_idx" ON "Payment"("buyerId");

-- CreateIndex
CREATE INDEX "Payment_photoId_idx" ON "Payment"("photoId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "EarningsLedger_contributorId_idx" ON "EarningsLedger"("contributorId");

-- CreateIndex
CREATE INDEX "EarningsLedger_photoId_idx" ON "EarningsLedger"("photoId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LicenseProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "LicenseGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsLedger" ADD CONSTRAINT "EarningsLedger_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsLedger" ADD CONSTRAINT "EarningsLedger_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsLedger" ADD CONSTRAINT "EarningsLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
