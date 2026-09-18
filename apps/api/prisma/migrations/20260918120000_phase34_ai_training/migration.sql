-- Phase 34: AI-training is a separate opt-in. Dataset pricing is undecided;
-- stock grants never include training. Minors are never eligible.

ALTER TABLE "Photo" ADD COLUMN "copyrightAiTraining" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Photo" ADD COLUMN "aiTrainingEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PhotoAppearance" ADD COLUMN "aiTraining" BOOLEAN NOT NULL DEFAULT false;
