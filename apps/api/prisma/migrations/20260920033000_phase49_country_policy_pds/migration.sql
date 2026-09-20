-- Phase 49 / P0: Country policy versions, G01–G16 gates, feature scopes,
-- transitions (sole legal path to change status), and GateEvidence/Approval.

CREATE TABLE "CountryPolicyVersion" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HOLD',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "preparedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CountryGate" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "rationale" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountryGate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GateEvidence" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GateApproval" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CountryFeatureScope" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'HOLD',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryFeatureScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CountryTransition" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "authorizeId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountryTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CountryPolicyVersion_countryCode_version_key" ON "CountryPolicyVersion"("countryCode", "version");
CREATE INDEX "CountryPolicyVersion_countryCode_status_idx" ON "CountryPolicyVersion"("countryCode", "status");
CREATE INDEX "CountryPolicyVersion_status_idx" ON "CountryPolicyVersion"("status");

CREATE UNIQUE INDEX "CountryGate_policyVersionId_code_key" ON "CountryGate"("policyVersionId", "code");
CREATE INDEX "CountryGate_status_idx" ON "CountryGate"("status");

CREATE INDEX "GateEvidence_gateId_idx" ON "GateEvidence"("gateId");
CREATE INDEX "GateApproval_gateId_idx" ON "GateApproval"("gateId");
CREATE INDEX "GateApproval_approverId_idx" ON "GateApproval"("approverId");

CREATE UNIQUE INDEX "CountryFeatureScope_policyVersionId_action_key" ON "CountryFeatureScope"("policyVersionId", "action");

CREATE INDEX "CountryTransition_policyVersionId_idx" ON "CountryTransition"("policyVersionId");
CREATE INDEX "CountryTransition_kind_idx" ON "CountryTransition"("kind");
CREATE INDEX "CountryTransition_createdAt_idx" ON "CountryTransition"("createdAt");

ALTER TABLE "CountryPolicyVersion" ADD CONSTRAINT "CountryPolicyVersion_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountryGate" ADD CONSTRAINT "CountryGate_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CountryPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GateEvidence" ADD CONSTRAINT "GateEvidence_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "CountryGate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GateApproval" ADD CONSTRAINT "GateApproval_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "CountryGate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountryFeatureScope" ADD CONSTRAINT "CountryFeatureScope_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CountryPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountryTransition" ADD CONSTRAINT "CountryTransition_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CountryPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
