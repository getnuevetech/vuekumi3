-- Homepage section order and static banner grids.

CREATE TABLE "HomeLayout" (
    "id" TEXT NOT NULL,
    "order" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeLayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeStaticBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "columns" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "widthVw" DOUBLE PRECISION NOT NULL,
    "heightVw" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeStaticBanner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeStaticBannerImage" (
    "id" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "imageSrc" TEXT NOT NULL,

    CONSTRAINT "HomeStaticBannerImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeStaticBannerImage_bannerId_idx" ON "HomeStaticBannerImage"("bannerId");

CREATE UNIQUE INDEX "HomeStaticBannerImage_bannerId_position_key" ON "HomeStaticBannerImage"("bannerId", "position");

ALTER TABLE "HomeStaticBannerImage" ADD CONSTRAINT "HomeStaticBannerImage_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "HomeStaticBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
