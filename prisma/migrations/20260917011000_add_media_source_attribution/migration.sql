ALTER TABLE "media_files"
  ADD COLUMN "source_provider" VARCHAR(50),
  ADD COLUMN "source_external_id" VARCHAR(100),
  ADD COLUMN "source_url" VARCHAR(2048),
  ADD COLUMN "source_author" VARCHAR(200),
  ADD COLUMN "source_author_url" VARCHAR(2048);
