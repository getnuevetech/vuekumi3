-- V21-P2: staff/manual creator briefs from Opportunity Engine demand
CREATE TABLE "CreatorBrief" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "country" TEXT,
    "libraryTier" TEXT,
    "sourceLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorBrief_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreatorBrief_status_createdAt_idx" ON "CreatorBrief"("status", "createdAt");
