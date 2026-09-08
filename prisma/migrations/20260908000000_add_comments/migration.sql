-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "world_cup_id" INTEGER NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "member_id" INTEGER,
    "nickname" VARCHAR(50) NOT NULL,
    "body" VARCHAR(30) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_world_cup_id_deleted_at_created_at_id_idx" ON "comments"("world_cup_id", "deleted_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "comments_candidate_id_idx" ON "comments"("candidate_id");

-- CreateIndex
CREATE INDEX "comments_member_id_idx" ON "comments"("member_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_world_cup_id_fkey" FOREIGN KEY ("world_cup_id") REFERENCES "world_cups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
