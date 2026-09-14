-- AlterTable
ALTER TABLE "ContributorProfile" ADD COLUMN "profileViews" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PhotographerFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "photographerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotographerFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotographerFollow_followerId_photographerId_key" ON "PhotographerFollow"("followerId", "photographerId");

-- CreateIndex
CREATE INDEX "PhotographerFollow_photographerId_idx" ON "PhotographerFollow"("photographerId");

-- CreateIndex
CREATE INDEX "PhotographerFollow_followerId_idx" ON "PhotographerFollow"("followerId");

-- AddForeignKey
ALTER TABLE "PhotographerFollow" ADD CONSTRAINT "PhotographerFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotographerFollow" ADD CONSTRAINT "PhotographerFollow_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
