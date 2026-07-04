-- CreateEnum
CREATE TYPE "BodyShape" AS ENUM ('HOURGLASS', 'PEAR', 'APPLE', 'RECTANGLE', 'INVERTED_TRIANGLE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "ClothingCategory" AS ENUM ('TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES', 'ACCESSORY', 'BAG');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('SPRING', 'SUMMER', 'FALL', 'WINTER');

-- CreateEnum
CREATE TYPE "LookSource" AS ENUM ('AI_SUGGESTED', 'USER_CREATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "bodyShape" "BodyShape",
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "locationLat" DOUBLE PRECISION,
    "locationLon" DOUBLE PRECISION,
    "locationName" TEXT,
    "stylePrefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clothing_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "originalImageUrl" TEXT NOT NULL,
    "processedImageUrl" TEXT,
    "category" "ClothingCategory" NOT NULL,
    "subcategory" TEXT,
    "colors" TEXT[],
    "primaryColor" TEXT,
    "pattern" TEXT,
    "seasons" "Season"[],
    "brand" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "wearCount" INTEGER NOT NULL DEFAULT 0,
    "lastWornDate" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clothing_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "looks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "source" "LookSource" NOT NULL DEFAULT 'USER_CREATED',
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "looks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "look_items" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "look_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wear_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookId" TEXT,
    "wornDate" DATE NOT NULL,
    "eventType" TEXT,
    "weather" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wear_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfit_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outfit_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "colorA" TEXT NOT NULL,
    "colorB" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "color_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "clothing_items_userId_category_idx" ON "clothing_items"("userId", "category");

-- CreateIndex
CREATE INDEX "clothing_items_userId_isArchived_idx" ON "clothing_items"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "looks_userId_idx" ON "looks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "look_items_lookId_itemId_key" ON "look_items"("lookId", "itemId");

-- CreateIndex
CREATE INDEX "wear_history_userId_wornDate_idx" ON "wear_history"("userId", "wornDate");

-- CreateIndex
CREATE UNIQUE INDEX "wear_history_userId_wornDate_lookId_key" ON "wear_history"("userId", "wornDate", "lookId");

-- CreateIndex
CREATE INDEX "outfit_feedback_userId_createdAt_idx" ON "outfit_feedback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "color_preferences_userId_colorA_colorB_key" ON "color_preferences"("userId", "colorA", "colorB");

-- AddForeignKey
ALTER TABLE "clothing_items" ADD CONSTRAINT "clothing_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "looks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "clothing_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wear_history" ADD CONSTRAINT "wear_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wear_history" ADD CONSTRAINT "wear_history_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "looks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_feedback" ADD CONSTRAINT "outfit_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_feedback" ADD CONSTRAINT "outfit_feedback_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "looks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "color_preferences" ADD CONSTRAINT "color_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
