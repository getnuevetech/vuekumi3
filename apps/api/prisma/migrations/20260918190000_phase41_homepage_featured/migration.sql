-- Phase 41: staff-pinned homepage featured slots. Unfilled positions keep
-- the live ranking fallback. Featuring is not a licence.

CREATE TABLE "HomeFeaturedPin" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeFeaturedPin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeFeaturedPin_slot_position_key" ON "HomeFeaturedPin"("slot", "position");
CREATE INDEX "HomeFeaturedPin_photoId_idx" ON "HomeFeaturedPin"("photoId");
CREATE INDEX "HomeFeaturedPin_slot_idx" ON "HomeFeaturedPin"("slot");

ALTER TABLE "HomeFeaturedPin" ADD CONSTRAINT "HomeFeaturedPin_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
