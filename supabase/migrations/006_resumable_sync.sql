-- Migration 006: Resumable full-catalog sync tracking columns
-- Adds 5 new columns to channels table to support:
--   - Resumable nextPageToken-driven ingestion
--   - Per-channel sync progress tracking
--   - Incremental re-sync after initial full sync completes
--   - Accurate "importing vs. genuinely complete" UI messaging

-- Add columns (IF NOT EXISTS pattern via DO block for idempotency)
DO $$
BEGIN
  -- sync_status: pending | in_progress | complete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'sync_status'
  ) THEN
    ALTER TABLE public.channels ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';
  END IF;

  -- sync_page_token: YouTube nextPageToken persisted between invocations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'sync_page_token'
  ) THEN
    ALTER TABLE public.channels ADD COLUMN sync_page_token TEXT DEFAULT NULL;
  END IF;

  -- synced_video_count: running count of videos fetched from YouTube so far
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'synced_video_count'
  ) THEN
    ALTER TABLE public.channels ADD COLUMN synced_video_count INT NOT NULL DEFAULT 0;
  END IF;

  -- total_video_count: YouTube's reported statistics.videoCount (for progress %)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'total_video_count'
  ) THEN
    ALTER TABLE public.channels ADD COLUMN total_video_count INT NOT NULL DEFAULT 0;
  END IF;

  -- last_full_sync_at: timestamp when sync_status last reached 'complete'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'last_full_sync_at'
  ) THEN
    ALTER TABLE public.channels ADD COLUMN last_full_sync_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Add CHECK constraint to prevent invalid sync_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'channels' AND constraint_name = 'channels_sync_status_check'
  ) THEN
    ALTER TABLE public.channels
      ADD CONSTRAINT channels_sync_status_check
      CHECK (sync_status IN ('pending', 'in_progress', 'complete'));
  END IF;
END $$;

-- Backfill: all existing channels are set to 'pending' so they get a full re-sync.
-- This is intentional: existing channels only have ≤50 videos from the old capped sync.
UPDATE public.channels
  SET sync_status = 'pending',
      synced_video_count = 0,
      sync_page_token = NULL
  WHERE sync_status = 'pending'; -- no-op if column was just added; safe to run multiple times

-- Index on sync_status so the scheduler can efficiently find pending/in_progress channels
CREATE INDEX IF NOT EXISTS idx_channels_sync_status
  ON public.channels (sync_status);

-- Index on parent_id + sync_status for the Manage Channels query
CREATE INDEX IF NOT EXISTS idx_channels_parent_sync
  ON public.channels (parent_id, sync_status);

-- Verify the new columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'channels'
  AND column_name IN ('sync_status', 'sync_page_token', 'synced_video_count', 'total_video_count', 'last_full_sync_at')
ORDER BY column_name;
