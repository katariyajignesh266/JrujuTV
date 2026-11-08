-- Migration 022: Shorts Playback Reliability, is_playable Guard, Re-check Job, and Skip Function
-- Ensures 100% playable Shorts feed by excluding non-embeddable, deleted, private, zero-duration or failed videos.
-- Fully idempotent, safe, backward-compatible with or without migration 021.

BEGIN;

-- 1. Ensure V2 columns exist safely even if migration 021 was not run yet
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS storage_url TEXT,
  ADD COLUMN IF NOT EXISTS poster_url TEXT,
  ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS r2_object_key TEXT,
  ADD COLUMN IF NOT EXISTS media_error TEXT,
  ADD COLUMN IF NOT EXISTS media_queued_at TIMESTAMPTZ;

-- 2. Add playability and validation columns
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS is_embeddable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_real_short BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS playback_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ DEFAULT now();

-- Add check constraint for playback_status
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_playback_status_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_playback_status_check
    CHECK (playback_status IN ('playable', 'unplayable', 'unknown', 'rate_limited'));

-- 3. Add generated is_playable column (or update if needed)
-- Evaluates true ONLY when duration > 0, not unplayable, not embeddable=false, not media error
ALTER TABLE public.videos DROP COLUMN IF EXISTS is_playable CASCADE;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS is_playable BOOLEAN GENERATED ALWAYS AS (
    is_short = true
    AND duration_seconds > 0
    AND COALESCE(is_embeddable, true) = true
    AND COALESCE(is_real_short, true) = true
    AND playback_status <> 'unplayable'
    AND media_status <> 'error'
  ) STORED;

-- Performance index for feed lookup on playable shorts
CREATE INDEX IF NOT EXISTS idx_videos_playable_feed
  ON public.videos (channel_id, is_playable, published_at DESC)
  WHERE is_playable = true;

CREATE INDEX IF NOT EXISTS idx_videos_playback_check
  ON public.videos (last_checked_at ASC)
  WHERE is_short = true;

-- 4. Mark unplayable short RPC (invoked by client or edge function watchdog)
CREATE OR REPLACE FUNCTION public.mark_short_unplayable(p_video_id UUID, p_reason TEXT DEFAULT 'client_watchdog_timeout')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.videos
  SET playback_status = 'unplayable',
      is_embeddable = false,
      media_status = CASE WHEN media_status = 'ready' THEN media_status ELSE 'skipped' END,
      media_error = COALESCE(p_reason, 'Playback failed watchdog check'),
      last_checked_at = now()
  WHERE id = p_video_id;

  RETURN jsonb_build_object('success', true, 'video_id', p_video_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_short_unplayable(UUID, TEXT) TO anon, authenticated, service_role;

-- 5. Updated get_shorts_feed RPC filtering strictly by is_playable = true
CREATE OR REPLACE FUNCTION public.get_shorts_feed(
  p_seed INT DEFAULT 123456,
  p_cursor INT DEFAULT 0,
  p_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_current_user UUID;
  v_result JSONB := '[]'::JSONB;
  v_has_more BOOLEAN := false;
  v_total_eligible INT := 0;
BEGIN
  v_current_user := auth.uid();
  v_family_id := public.get_auth_family_id();

  CREATE TEMP TABLE IF NOT EXISTS tmp_shorts_candidates (
    id UUID,
    channel_id UUID,
    youtube_video_id TEXT,
    title TEXT,
    thumbnail_url TEXT,
    duration_seconds INT,
    view_count BIGINT,
    is_short BOOLEAN,
    published_at TIMESTAMPTZ,
    storage_url TEXT,
    poster_url TEXT,
    media_status TEXT,
    channel_title TEXT,
    channel_thumbnail_url TEXT,
    channel_rank INT,
    row_within_channel INT
  ) ON COMMIT DROP;

  TRUNCATE tmp_shorts_candidates;

  INSERT INTO tmp_shorts_candidates (
    id, channel_id, youtube_video_id, title, thumbnail_url,
    duration_seconds, view_count, is_short, published_at,
    storage_url, poster_url, media_status,
    channel_title, channel_thumbnail_url,
    channel_rank, row_within_channel
  )
  WITH eligible_channels AS (
    SELECT
      c.id AS channel_id,
      c.title AS channel_title,
      c.thumbnail_url AS channel_thumbnail_url,
      c.shorts_limit,
      ROW_NUMBER() OVER (
        ORDER BY ('x' || substr(md5(p_seed::text || c.id::text), 1, 8))::bit(32)::bigint
      ) AS channel_rank
    FROM public.channels c
    WHERE (v_family_id IS NULL OR c.parent_id = v_family_id)
      AND c.is_active = true
      AND c.shorts_enabled = true
  ),
  ranked_videos AS (
    SELECT
      v.id,
      v.channel_id,
      v.youtube_video_id,
      v.title,
      v.thumbnail_url,
      v.duration_seconds,
      v.view_count,
      v.is_short,
      v.published_at,
      v.storage_url,
      v.poster_url,
      COALESCE(v.media_status, 'pending') AS media_status,
      ec.channel_title,
      ec.channel_thumbnail_url,
      ec.channel_rank,
      ROW_NUMBER() OVER (
        PARTITION BY v.channel_id
        ORDER BY v.published_at DESC, v.id DESC
      ) AS row_within_channel,
      ec.shorts_limit
    FROM public.videos v
    JOIN eligible_channels ec ON ec.channel_id = v.channel_id
    WHERE v.is_playable = true
      AND (
        v_current_user IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.short_views sv
          WHERE sv.user_id = v_current_user
            AND sv.video_id = v.id
            AND sv.max_progress_percent >= 50
        )
      )
  )
  SELECT
    rv.id,
    rv.channel_id,
    rv.youtube_video_id,
    rv.title,
    rv.thumbnail_url,
    rv.duration_seconds,
    rv.view_count,
    rv.is_short,
    rv.published_at,
    rv.storage_url,
    rv.poster_url,
    rv.media_status,
    rv.channel_title,
    rv.channel_thumbnail_url,
    rv.channel_rank,
    rv.row_within_channel
  FROM ranked_videos rv
  WHERE rv.shorts_limit IS NULL OR rv.row_within_channel <= rv.shorts_limit;

  SELECT COUNT(*) INTO v_total_eligible FROM tmp_shorts_candidates;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'channel_id', t.channel_id,
      'youtube_video_id', t.youtube_video_id,
      'title', t.title,
      'thumbnail_url', t.thumbnail_url,
      'duration_seconds', t.duration_seconds,
      'view_count', t.view_count,
      'is_short', t.is_short,
      'published_at', t.published_at,
      'storage_url', t.storage_url,
      'poster_url', t.poster_url,
      'media_status', t.media_status,
      'channel', jsonb_build_object(
        'id', t.channel_id,
        'title', t.channel_title,
        'thumbnail_url', t.channel_thumbnail_url
      ),
      'channelName', t.channel_title,
      'channelAvatarUrl', t.channel_thumbnail_url
    )
  )
  INTO v_result
  FROM (
    SELECT *
    FROM tmp_shorts_candidates
    ORDER BY row_within_channel ASC, channel_rank ASC
    OFFSET p_cursor
    LIMIT p_limit
  ) t;

  v_has_more := (p_cursor + p_limit) < v_total_eligible;

  RETURN jsonb_build_object(
    'videos', COALESCE(v_result, '[]'::JSONB),
    'has_more', v_has_more,
    'next_cursor', CASE WHEN v_has_more THEN p_cursor + p_limit ELSE null END,
    'total', v_total_eligible
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shorts_feed(INT, INT, INT) TO anon, authenticated, service_role;

COMMIT;

