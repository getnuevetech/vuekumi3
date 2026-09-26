ALTER TABLE "HomeFeaturedPin" ADD COLUMN "imageSrc" TEXT;

ALTER TABLE "HomeSectionConfig" ADD COLUMN "contributorIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "HomeSectionConfig" ADD COLUMN "randomize" BOOLEAN NOT NULL DEFAULT false;
