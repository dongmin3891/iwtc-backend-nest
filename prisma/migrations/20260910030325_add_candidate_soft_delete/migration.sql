-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_candidate_id_fkey";

-- DropIndex
DROP INDEX "candidates_world_cup_id_visible_type_idx";

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "candidates_world_cup_id_deleted_at_visible_type_idx" ON "candidates"("world_cup_id", "deleted_at", "visible_type");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
