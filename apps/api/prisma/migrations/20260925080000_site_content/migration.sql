-- Public menu, logo, and page words. Empty until an admin saves a document;
-- the application fills any missing fields from the built-in defaults.

CREATE TABLE "SiteContent" (
  "id" TEXT NOT NULL,
  "body" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);
