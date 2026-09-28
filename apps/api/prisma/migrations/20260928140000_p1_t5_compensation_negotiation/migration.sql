-- P1-T5: compensation negotiation (Proposal → Agreement → Activation). No model payouts yet.

CREATE TYPE "CompensationTermMode" AS ENUM ('percentage', 'fixed', 'both', 'zero');
CREATE TYPE "CompensationProposalStatus" AS ENUM ('proposed', 'countered', 'accepted', 'declined', 'activated', 'superseded');

CREATE TABLE "CompensationProposal" (
  "id" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "appearanceId" TEXT NOT NULL,
  "proposedById" TEXT NOT NULL,
  "proposedAs" TEXT NOT NULL,
  "status" "CompensationProposalStatus" NOT NULL DEFAULT 'proposed',
  "mode" "CompensationTermMode" NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fixedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentBase" TEXT NOT NULL DEFAULT 'contributor_distributable_share',
  "notes" TEXT,
  "parentId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompensationProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompensationProposal_photoId_idx" ON "CompensationProposal"("photoId");
CREATE INDEX "CompensationProposal_appearanceId_idx" ON "CompensationProposal"("appearanceId");
CREATE INDEX "CompensationProposal_status_idx" ON "CompensationProposal"("status");
CREATE INDEX "CompensationProposal_proposedById_idx" ON "CompensationProposal"("proposedById");

ALTER TABLE "CompensationProposal" ADD CONSTRAINT "CompensationProposal_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationProposal" ADD CONSTRAINT "CompensationProposal_appearanceId_fkey"
  FOREIGN KEY ("appearanceId") REFERENCES "PhotoAppearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationProposal" ADD CONSTRAINT "CompensationProposal_proposedById_fkey"
  FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationProposal" ADD CONSTRAINT "CompensationProposal_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "CompensationProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CompensationProposalEvent" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompensationProposalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompensationProposalEvent_proposalId_idx" ON "CompensationProposalEvent"("proposalId");
CREATE INDEX "CompensationProposalEvent_actorId_idx" ON "CompensationProposalEvent"("actorId");

ALTER TABLE "CompensationProposalEvent" ADD CONSTRAINT "CompensationProposalEvent_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "CompensationProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationProposalEvent" ADD CONSTRAINT "CompensationProposalEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
