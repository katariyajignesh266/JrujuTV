-- Migration 011: Watched-Video Feed Filter
-- ─────────────────────────────────────────────────────────────────────────────
-- Purpose:
--   When a child has watched ≥90% of a video (progress_percent >= 90),
--   that video must NOT appear again in:
--     1. The home feed  (get_interleaved_feed_cursor)
--     2. The shorts feed (queried server-side)
--     3. The channel video listing
--
--   Strategy: single fast index scan → array of excluded video IDs →
--   passed as p_exclude_video_ids to every feed/channel query.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEX: speed up the "completed videos for this child" lookup
-- The query is: WHERE child_id = $1 AND progress_percent >= 90
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_watch_sessions_child_progress
  ON public.watch_sessions (child_id, progress_percent DESC)
  WHERE progress_percent >= 90;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_child_completed_video_ids
-- Returns an array of video UUIDs where the child has watched ≥90%.
-- SECURITY DEFINER: fast bypass of RLS; caller must pass their own child_id.
-- Called once per feed page request — O(k) where k = completed videos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_child_completed_video_ids(p_child_id UUID)
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT video_id
    FROM public.watch_sessions
    WHERE child_id = p_child_id
      AND progress_percent >= 90
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_child_completed_video_ids TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED RPC: get_interleaved_feed_cursor
-- Adds p_exclude_video_ids parameter: any video in this array is filtered
-- from every channel's candidate pool before interleaving.
-- Falls back gracefully: empty array = no filtering (unauthenticated users).
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the old 4-parameter overload so we only have one signature for GRANT
DROP FUNCTION IF EXISTS public.get_interleaved_feed_cursor(UUID[], JSONB, INT, INT);

CREATE OR REPLACE FUNCTION public.get_interleaved_feed_cursor(
  p_channel_ids       UUID[],
  p_channel_cursors   JSONB    DEFAULT '{}'::jsonb,
  p_limit             INT      DEFAULT 20,
  p_min_duration      INT      DEFAULT 300,
  p_exclude_video_ids UUID[]   DEFAULT '{}'::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_channel_count INT;
  v_per_channel_limit INT;
  v_channel_id UUID;
  v_cursor JSONB;
  v_last_pub TIMESTAMPTZ;
  v_last_id UUID;
  v_result_videos JSONB := '[]'::jsonb;
  v_next_cursors JSONB := COALESCE(p_channel_cursors, '{}'::jsonb);
  v_has_more BOOLEAN := false;
  v_interleaved_record RECORD;
  v_exclude_ids UUID[];
BEGIN
  IF p_channel_ids IS NULL OR array_length(p_channel_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'videos', '[]'::jsonb,
      'has_more', false,
      'next_cursors', '{}'::jsonb
    );
  END IF;

  -- Normalise: treat NULL as empty array so the NOT = ANY() predicate works correctly
  v_exclude_ids := COALESCE(p_exclude_video_ids, '{}'::UUID[]);

  v_channel_count := array_length(p_channel_ids, 1);
  v_per_channel_limit := GREATEST(4, CEIL(p_limit::FLOAT / v_channel_count)::INT + 4);

  -- Temporary table for candidates (dropped automatically on transaction end)
  CREATE TEMP TABLE tmp_feed_candidates (
    id UUID,
    channel_id UUID,
    youtube_video_id TEXT,
    title TEXT,
    thumbnail_url TEXT,
    duration_seconds INT,
    view_count BIGINT,
    is_short BOOLEAN,
    published_at TIMESTAMPTZ,
    channel_title TEXT,
    channel_thumbnail_url TEXT,
    channel_rank INT,
    row_within_channel INT
  ) ON COMMIT DROP;

  -- Keyset query per channel — exclude completed videos
  FOREACH v_channel_id IN ARRAY p_channel_ids
  LOOP
    v_cursor := p_channel_cursors -> v_channel_id::TEXT;
    IF v_cursor IS NOT NULL AND (v_cursor ? 'published_at') THEN
      v_last_pub := (v_cursor ->> 'published_at')::TIMESTAMPTZ;
      v_last_id  := (v_cursor ->> 'id')::UUID;

      INSERT INTO tmp_feed_candidates (
        id, channel_id, youtube_video_id, title, thumbnail_url,
        duration_seconds, view_count, is_short, published_at,
        channel_title, channel_thumbnail_url, channel_rank, row_within_channel
      )
      SELECT
        v.id, v.channel_id, v.youtube_video_id, v.title, v.thumbnail_url,
        v.duration_seconds, v.view_count, v.is_short, v.published_at,
        c.title, c.thumbnail_url,
        array_position(p_channel_ids, v.channel_id),
        ROW_NUMBER() OVER (ORDER BY v.published_at DESC, v.id DESC)
      FROM public.videos v
      JOIN public.channels c ON c.id = v.channel_id
      WHERE v.channel_id = v_channel_id
        AND v.duration_seconds >= p_min_duration
        AND v.is_short = false
        AND (array_length(v_exclude_ids, 1) IS NULL OR v.id <> ALL(v_exclude_ids))
        AND (
          v.published_at < v_last_pub
          OR (v.published_at = v_last_pub AND v.id < v_last_id)
        )
      ORDER BY v.published_at DESC, v.id DESC
      LIMIT v_per_channel_limit + 1;
    ELSE
      INSERT INTO tmp_feed_candidates (
        id, channel_id, youtube_video_id, title, thumbnail_url,
        duration_seconds, view_count, is_short, published_at,
        channel_title, channel_thumbnail_url, channel_rank, row_within_channel
      )
      SELECT
        v.id, v.channel_id, v.youtube_video_id, v.title, v.thumbnail_url,
        v.duration_seconds, v.view_count, v.is_short, v.published_at,
        c.title, c.thumbnail_url,
        array_position(p_channel_ids, v.channel_id),
        ROW_NUMBER() OVER (ORDER BY v.published_at DESC, v.id DESC)
      FROM public.videos v
      JOIN public.channels c ON c.id = v.channel_id
      WHERE v.channel_id = v_channel_id
        AND v.duration_seconds >= p_min_duration
        AND v.is_short = false
        AND (array_length(v_exclude_ids, 1) IS NULL OR v.id <> ALL(v_exclude_ids))
      ORDER BY v.published_at DESC, v.id DESC
      LIMIT v_per_channel_limit + 1;
    END IF;
  END LOOP;

  -- Detect has_more before trimming probe row
  IF EXISTS (SELECT 1 FROM tmp_feed_candidates WHERE row_within_channel > v_per_channel_limit) THEN
    v_has_more := true;
  END IF;

  DELETE FROM tmp_feed_candidates WHERE row_within_channel > v_per_channel_limit;

  -- Round-robin interleave: row_within_channel ASC, channel_rank ASC
  FOR v_interleaved_record IN
    SELECT
      id, channel_id, youtube_video_id, title, thumbnail_url,
      duration_seconds, view_count, is_short, published_at,
      channel_title, channel_thumbnail_url
    FROM tmp_feed_candidates
    ORDER BY row_within_channel ASC, channel_rank ASC
    LIMIT p_limit
  LOOP
    v_result_videos := v_result_videos || jsonb_build_object(
      'id',               v_interleaved_record.id,
      'channel_id',       v_interleaved_record.channel_id,
      'youtube_video_id', v_interleaved_record.youtube_video_id,
      'title',            v_interleaved_record.title,
      'thumbnail_url',    v_interleaved_record.thumbnail_url,
      'duration_seconds', v_interleaved_record.duration_seconds,
      'view_count',       v_interleaved_record.view_count,
      'is_short',         v_interleaved_record.is_short,
      'published_at',     v_interleaved_record.published_at,
      'channel', jsonb_build_object(
        'id',            v_interleaved_record.channel_id,
        'title',         v_interleaved_record.channel_title,
        'thumbnail_url', v_interleaved_record.channel_thumbnail_url
      ),
      'channelName',      v_interleaved_record.channel_title,
      'channelAvatarUrl', v_interleaved_record.channel_thumbnail_url
    );

    v_next_cursors := jsonb_set(
      v_next_cursors,
      ARRAY[v_interleaved_record.channel_id::TEXT],
      jsonb_build_object(
        'published_at', v_interleaved_record.published_at,
        'id',           v_interleaved_record.id
      )
    );
  END LOOP;

  -- Final has_more check: unconsumed candidates remaining?
  IF (SELECT COUNT(*) FROM tmp_feed_candidates) > jsonb_array_length(v_result_videos) THEN
    v_has_more := true;
  END IF;

  RETURN jsonb_build_object(
    'videos',       v_result_videos,
    'has_more',     v_has_more,
    'next_cursors', v_next_cursors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_interleaved_feed_cursor(
  UUID[], JSONB, INT, INT, UUID[]
) TO authenticated, service_role;

