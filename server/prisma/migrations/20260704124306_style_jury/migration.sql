-- CreateEnum
CREATE TYPE "RatingSource" AS ENUM ('LLM', 'HEURISTIC');

-- CreateTable
CREATE TABLE "outfit_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookId" TEXT,
    "overallScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "personas" JSONB NOT NULL,
    "source" "RatingSource" NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outfit_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outfit_ratings_userId_createdAt_idx" ON "outfit_ratings"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "outfit_ratings" ADD CONSTRAINT "outfit_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_ratings" ADD CONSTRAINT "outfit_ratings_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "looks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

