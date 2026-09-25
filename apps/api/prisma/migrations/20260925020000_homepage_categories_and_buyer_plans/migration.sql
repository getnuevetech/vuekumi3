-- Featured images stay in the edge slot. Category banners store an optional
-- photograph plus the category the banner links to. Editorial can rotate pinned
-- photographs or pull live images from one category. Buyer plans are editable
-- in admin; Vuekumi+ keeps the existing $19 / 30 day price.

ALTER TABLE "HomeFeaturedPin" ALTER COLUMN "photoId" DROP NOT NULL;
ALTER TABLE "HomeFeaturedPin" ADD COLUMN "category" TEXT;

CREATE TABLE "HomeSectionConfig" (
    "slot" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'pins',
    "category" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSectionConfig_pkey" PRIMARY KEY ("slot")
);

CREATE TABLE "BuyerPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuyerPlan_slug_key" ON "BuyerPlan"("slug");

INSERT INTO "BuyerPlan" ("id", "slug", "name", "priceUsd", "periodDays", "description", "enabled", "sortOrder", "createdAt", "updatedAt")
VALUES (
    'plan_vuekumi_plus',
    'plus',
    'Vuekumi+',
    19,
    30,
    'Unlimited royalty-free downloads from the free collection for 30 days. Premium images stay billed per licence.',
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
