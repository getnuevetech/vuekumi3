-- Desktop size of the homepage featured strip, as a percent of the screen width.
ALTER TABLE "HomeSectionConfig" ADD COLUMN "widthVw" DOUBLE PRECISION;
ALTER TABLE "HomeSectionConfig" ADD COLUMN "heightVw" DOUBLE PRECISION;
