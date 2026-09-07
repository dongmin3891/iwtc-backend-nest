-- CreateEnum
CREATE TYPE "MediaFileType" AS ENUM ('STATIC_MEDIA_FILE', 'INTERNET_VIDEO_URL');

-- CreateEnum
CREATE TYPE "MediaDetailType" AS ENUM ('JPEG', 'JPG', 'PNG', 'GIF', 'MP4', 'YOU_TUBE_URL');

-- CreateTable
CREATE TABLE "media_files" (
    "id" SERIAL NOT NULL,
    "file_type" "MediaFileType" NOT NULL,
    "detail_type" "MediaDetailType" NOT NULL,
    "object_key" VARCHAR(1024),
    "thumbnail_object_key" VARCHAR(1024),
    "external_url" VARCHAR(2048),
    "original_name" VARCHAR(255),
    "video_start_time" VARCHAR(5),
    "video_play_duration" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_files_object_key_check" CHECK (
        "object_key" IS NULL
        OR ("object_key" !~ '^/' AND "object_key" !~ '(^|/)\.\.?(/|$)')
    ),
    CONSTRAINT "media_files_thumbnail_object_key_check" CHECK (
        "thumbnail_object_key" IS NULL
        OR ("thumbnail_object_key" !~ '^/' AND "thumbnail_object_key" !~ '(^|/)\.\.?(/|$)')
    ),
    CONSTRAINT "media_files_type_fields_check" CHECK (
        (
            "file_type" = 'STATIC_MEDIA_FILE'
            AND "detail_type" IN ('JPEG', 'JPG', 'PNG', 'GIF', 'MP4')
            AND "object_key" IS NOT NULL
            AND "external_url" IS NULL
            AND "original_name" IS NOT NULL
            AND "video_start_time" IS NULL
            AND "video_play_duration" IS NULL
        )
        OR (
            "file_type" = 'INTERNET_VIDEO_URL'
            AND "detail_type" = 'YOU_TUBE_URL'
            AND "object_key" IS NULL
            AND "thumbnail_object_key" IS NULL
            AND "external_url" ~ '^https://'
            AND "original_name" IS NULL
            AND "video_start_time" ~ '^[0-9]{5}$'
            AND "video_play_duration" BETWEEN 2 AND 5
        )
    )
);

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
