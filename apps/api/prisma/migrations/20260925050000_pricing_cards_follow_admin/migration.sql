-- Homepage and pricing-page cards read the same buyer plans.
-- Feature lines, badge, highlight, and an optional homepage photograph
-- are edited in admin. The homepage heading is stored with the pricing section.

ALTER TABLE "BuyerPlan" ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BuyerPlan" ADD COLUMN "badge" TEXT;
ALTER TABLE "BuyerPlan" ADD COLUMN "highlighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BuyerPlan" ADD COLUMN "homePhotoId" TEXT;

ALTER TABLE "HomeSectionConfig" ADD COLUMN "kicker" TEXT;
ALTER TABLE "HomeSectionConfig" ADD COLUMN "title" TEXT;

UPDATE "BuyerPlan"
SET
  "highlighted" = true,
  "badge" = 'Most popular',
  "features" = ARRAY[
    'Unlimited royalty-free downloads from the free collection',
    'Premium images still billed per licence',
    'Cancel anytime — access lasts through the paid period'
  ]::TEXT[]
WHERE "slug" = 'plus' AND cardinality("features") = 0;
