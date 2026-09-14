-- CreateTable
CREATE TABLE "PhotoFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoFavorite_userId_photoId_key" ON "PhotoFavorite"("userId", "photoId");

-- CreateIndex
CREATE INDEX "PhotoFavorite_photoId_idx" ON "PhotoFavorite"("photoId");

-- CreateIndex
CREATE INDEX "PhotoFavorite_userId_idx" ON "PhotoFavorite"("userId");

-- AddForeignKey
ALTER TABLE "PhotoFavorite" ADD CONSTRAINT "PhotoFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoFavorite" ADD CONSTRAINT "PhotoFavorite_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
