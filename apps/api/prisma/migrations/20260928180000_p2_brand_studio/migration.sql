-- P2 Brand Studio foundation: buyer creative workspace projects.

CREATE TYPE "BrandProjectStatus" AS ENUM ('open', 'closed');

CREATE TABLE "BrandProject" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "agencyId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "campaignId" TEXT,
    "status" "BrandProjectStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandProjectCollection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandProjectCollection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrandProject_ownerId_createdAt_idx" ON "BrandProject"("ownerId", "createdAt");
CREATE INDEX "BrandProject_agencyId_idx" ON "BrandProject"("agencyId");
CREATE INDEX "BrandProject_campaignId_idx" ON "BrandProject"("campaignId");
CREATE INDEX "BrandProject_status_idx" ON "BrandProject"("status");

CREATE UNIQUE INDEX "BrandProjectCollection_projectId_collectionId_key"
  ON "BrandProjectCollection"("projectId", "collectionId");
CREATE INDEX "BrandProjectCollection_collectionId_idx" ON "BrandProjectCollection"("collectionId");

ALTER TABLE "BrandProject" ADD CONSTRAINT "BrandProject_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandProject" ADD CONSTRAINT "BrandProject_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrandProject" ADD CONSTRAINT "BrandProject_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BrandProjectCollection" ADD CONSTRAINT "BrandProjectCollection_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "BrandProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandProjectCollection" ADD CONSTRAINT "BrandProjectCollection_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
