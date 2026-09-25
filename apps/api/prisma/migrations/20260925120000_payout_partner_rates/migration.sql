-- Contributor earnings stay on the USD ledger.
-- Home-currency display uses the payout partner rate for the contributor's country.

CREATE TABLE "CountryPayoutConfig" (
  "countryCode" TEXT NOT NULL,
  "gatewayId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CountryPayoutConfig_pkey" PRIMARY KEY ("countryCode")
);

CREATE TABLE "PayoutFxRate" (
  "countryCode" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "rateToUsd" DOUBLE PRECISION NOT NULL,
  "gatewayId" TEXT,
  "partnerName" TEXT NOT NULL,
  "partnerSlug" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutFxRate_pkey" PRIMARY KEY ("countryCode")
);

ALTER TABLE "CountryPayoutConfig" ADD CONSTRAINT "CountryPayoutConfig_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountryPayoutConfig" ADD CONSTRAINT "CountryPayoutConfig_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutFxRate" ADD CONSTRAINT "PayoutFxRate_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutFxRate" ADD CONSTRAINT "PayoutFxRate_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;
