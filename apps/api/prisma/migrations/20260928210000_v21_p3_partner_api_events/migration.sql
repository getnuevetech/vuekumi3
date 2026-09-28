-- V21-P3: Partner API attribution / view / preview-download events (no fees, no licence grant)
CREATE TABLE "PartnerApiEvent" (
    "id" TEXT NOT NULL,
    "partnerKeyId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fileVariant" TEXT,
    "referrer" TEXT,
    "source" TEXT DEFAULT 'partner_api',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerApiEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerApiEvent_partnerKeyId_createdAt_idx" ON "PartnerApiEvent"("partnerKeyId", "createdAt");
CREATE INDEX "PartnerApiEvent_photoId_createdAt_idx" ON "PartnerApiEvent"("photoId", "createdAt");
CREATE INDEX "PartnerApiEvent_eventType_createdAt_idx" ON "PartnerApiEvent"("eventType", "createdAt");

ALTER TABLE "PartnerApiEvent" ADD CONSTRAINT "PartnerApiEvent_partnerKeyId_fkey" FOREIGN KEY ("partnerKeyId") REFERENCES "PartnerApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerApiEvent" ADD CONSTRAINT "PartnerApiEvent_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
