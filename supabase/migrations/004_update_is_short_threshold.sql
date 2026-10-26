-- Migration 004: Update is_short threshold from <= 60s to < 120s
-- This drops and re-creates the generated column, which automatically
-- re-evaluates all existing rows — no manual backfill needed.

ALTER TABLE public.videos DROP COLUMN is_short;
ALTER TABLE public.videos ADD COLUMN is_short BOOLEAN NOT NULL GENERATED ALWAYS AS (duration_seconds < 120) STORED;

-- Recreate the index on the new column
DROP INDEX IF EXISTS idx_videos_is_short;
CREATE INDEX idx_videos_is_short ON public.videos(channel_id, is_short);
