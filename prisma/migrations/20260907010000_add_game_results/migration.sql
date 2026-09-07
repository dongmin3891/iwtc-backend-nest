-- CreateTable
CREATE TABLE "game_plays" (
    "id" UUID NOT NULL,
    "world_cup_id" INTEGER NOT NULL,
    "initial_round" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "game_plays_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "game_plays_initial_round_check" CHECK ("initial_round" IN (2, 4, 8, 16, 32, 64, 128, 256))
);

-- CreateTable
CREATE TABLE "game_placements" (
    "game_play_id" UUID NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_placements_pkey" PRIMARY KEY ("game_play_id", "rank"),
    CONSTRAINT "game_placements_rank_check" CHECK ("rank" BETWEEN 1 AND 4),
    CONSTRAINT "game_placements_rank_score_check" CHECK (
        ("rank" = 1 AND "score" = 10)
        OR ("rank" = 2 AND "score" = 7)
        OR ("rank" IN (3, 4) AND "score" = 4)
    )
);

-- CreateIndex
CREATE INDEX "game_plays_world_cup_id_completed_at_idx" ON "game_plays"("world_cup_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "game_placements_game_play_id_candidate_id_key" ON "game_placements"("game_play_id", "candidate_id");

-- CreateIndex
CREATE INDEX "game_placements_candidate_id_idx" ON "game_placements"("candidate_id");

-- AddForeignKey
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_world_cup_id_fkey" FOREIGN KEY ("world_cup_id") REFERENCES "world_cups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_placements" ADD CONSTRAINT "game_placements_game_play_id_fkey" FOREIGN KEY ("game_play_id") REFERENCES "game_plays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_placements" ADD CONSTRAINT "game_placements_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
