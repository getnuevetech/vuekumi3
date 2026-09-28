-- P2 Content Opportunity Engine foundation: append-only search demand events.

CREATE TABLE "SearchOpportunityEvent" (
    "id" TEXT NOT NULL,
    "q" TEXT NOT NULL DEFAULT '',
    "qNorm" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "country" TEXT,
    "license" TEXT,
    "libraryTier" TEXT,
    "tag" TEXT,
    "photographer" TEXT,
    "resultCount" INTEGER NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT,
    "anonymousSessionId" TEXT,
    "source" TEXT DEFAULT 'catalog',
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchOpportunityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchOpportunityEvent_qNorm_idx" ON "SearchOpportunityEvent"("qNorm");
CREATE INDEX "SearchOpportunityEvent_createdAt_idx" ON "SearchOpportunityEvent"("createdAt");
CREATE INDEX "SearchOpportunityEvent_resultCount_idx" ON "SearchOpportunityEvent"("resultCount");
CREATE INDEX "SearchOpportunityEvent_qNorm_resultCount_idx" ON "SearchOpportunityEvent"("qNorm", "resultCount");
