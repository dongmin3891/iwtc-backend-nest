-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VisibilityType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "world_cups" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "visible_type" "VisibilityType" NOT NULL DEFAULT 'PUBLIC',
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "world_cups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" SERIAL NOT NULL,
    "world_cup_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "media_file_id" INTEGER,
    "visible_type" "VisibilityType" NOT NULL DEFAULT 'PUBLIC',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "world_cups_visible_type_id_idx" ON "world_cups"("visible_type", "id");

-- CreateIndex
CREATE INDEX "world_cups_visible_type_views_idx" ON "world_cups"("visible_type", "views");

-- CreateIndex
CREATE INDEX "candidates_world_cup_id_visible_type_idx" ON "candidates"("world_cup_id", "visible_type");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_world_cup_id_sort_order_key" ON "candidates"("world_cup_id", "sort_order");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_world_cup_id_fkey" FOREIGN KEY ("world_cup_id") REFERENCES "world_cups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
