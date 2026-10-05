-- One-time streams: the cancellation reason gets its own columns, so the
-- normal note survives a cancel + restore (review of step 1, 2026-10-05).
ALTER TABLE "ScheduleException" ADD COLUMN "cancelReasonEn" VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN "cancelReasonDe" VARCHAR(200) NOT NULL DEFAULT '';

-- Twitch covers only from the box-art path images.remotePatterns allows
-- (a prefix check let other static-cdn paths through, which next/image
-- then rejects). Hand-added, as the earlier checks.
ALTER TABLE "ScheduleSlot" DROP CONSTRAINT "ScheduleSlot_twitch_shape_check";
ALTER TABLE "ScheduleException" DROP CONSTRAINT "ScheduleException_twitch_shape_check";
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_twitch_shape_check" CHECK ("twitchCategoryId" IS NULL OR ("twitchCategoryName" IS NOT NULL AND ("twitchBoxArtUrl" IS NULL OR "twitchBoxArtUrl" ~ '^https://static-cdn\.jtvnw\.net/ttv-boxart/[A-Za-z0-9_.%-]+$')));
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_twitch_shape_check" CHECK ("twitchCategoryId" IS NULL OR ("twitchCategoryName" IS NOT NULL AND ("twitchBoxArtUrl" IS NULL OR "twitchBoxArtUrl" ~ '^https://static-cdn\.jtvnw\.net/ttv-boxart/[A-Za-z0-9_.%-]+$')));
