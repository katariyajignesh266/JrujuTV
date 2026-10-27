-- Migration 005: Feed performance composite indexes and server-side cursor interleaving RPC

-- 1. COMPOSITE INDEXES FOR FAST KEYSET SCANNING & DURATION FILTERING
CREATE INDEX IF NOT EXISTS idx_videos_feed_keyset 
  ON public.videos (channel_id, duration_seconds, is_short, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_videos_shorts_feed 
  ON public.videos (channel_id, is_short, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_videos_channel_duration 
  ON public.videos (channel_id, duration_seconds);

-- 2. SERVER-SIDE INTERLEAVED FEED GENERATOR WITH KEYSET CURSOR PAGINATION
-- Security Invoker ensures it automatically inherits the active caller's RLS policies
CREATE OR REPLACE FUNCTION public.get_interleaved_feed_cursor(
  p_channel_ids UUID[],
  p_channel_cursors JSONB DEFAULT '{}'::jsonb,
  p_limit INT DEFAULT 20,
  p_min_duration INT DEFAULT 300
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
BEGIN
  IF p_channel_ids IS NULL OR array_length(p_channel_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'videos', '[]'::jsonb,
      'has_more', false,
      'next_cursors', '{}'::jsonb
    );
  END IF;

  v_channel_count := array_length(p_channel_ids, 1);
  -- Fetch enough candidates per channel to fulfill the requested limit during round-robin
  v_per_channel_limit := GREATEST(4, CEIL(p_limit::FLOAT / v_channel_count)::INT + 4);

  -- Temporary table to hold candidates across channels
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

  -- Keyset query per channel
  FOREACH v_channel_id IN ARRAY p_channel_ids
  LOOP
    v_cursor := p_channel_cursors -> v_channel_id::TEXT;
    IF v_cursor IS NOT NULL AND (v_cursor ? 'published_at') THEN
      v_last_pub := (v_cursor ->> 'published_at')::TIMESTAMPTZ;
      v_last_id := (v_cursor ->> 'id')::UUID;

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
        AND (
          v.published_at < v_last_pub
          OR (v.published_at = v_last_pub AND v.id < v_last_id)
        )
      ORDER BY v.published_at DESC, v.id DESC
      LIMIT v_per_channel_limit + 1;
    ELSE
      -- First page: no cursor for this channel
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
      ORDER BY v.published_at DESC, v.id DESC
      LIMIT v_per_channel_limit + 1;
    END IF;
  END LOOP;

  -- Check if any channel has items beyond v_per_channel_limit (indicates has_more)
  IF EXISTS (SELECT 1 FROM tmp_feed_candidates WHERE row_within_channel > v_per_channel_limit) THEN
    v_has_more := true;
  END IF;

  -- Delete the extra probe rows
  DELETE FROM tmp_feed_candidates WHERE row_within_channel > v_per_channel_limit;

  -- Round-robin interleaving by ordering by (row_within_channel, channel_rank)
  -- This guarantees strict alternating channel order per cycle
  FOR v_interleaved_record IN
    SELECT 
      id, channel_id, youtube_video_id, title, thumbnail_url,
      duration_seconds, view_count, is_short, published_at,
      channel_title, channel_thumbnail_url
    FROM tmp_feed_candidates
    ORDER BY row_within_channel ASC, channel_rank ASC
    LIMIT p_limit
  LOOP
    -- Append video to JSON result array
    v_result_videos := v_result_videos || jsonb_build_object(
      'id', v_interleaved_record.id,
      'channel_id', v_interleaved_record.channel_id,
      'youtube_video_id', v_interleaved_record.youtube_video_id,
      'title', v_interleaved_record.title,
      'thumbnail_url', v_interleaved_record.thumbnail_url,
      'duration_seconds', v_interleaved_record.duration_seconds,
      'view_count', v_interleaved_record.view_count,
      'is_short', v_interleaved_record.is_short,
      'published_at', v_interleaved_record.published_at,
      'channel', jsonb_build_object(
        'id', v_interleaved_record.channel_id,
        'title', v_interleaved_record.channel_title,
        'thumbnail_url', v_interleaved_record.channel_thumbnail_url
      ),
      'channelName', v_interleaved_record.channel_title,
      'channelAvatarUrl', v_interleaved_record.channel_thumbnail_url
    );

    -- Update channel cursor for this channel
    v_next_cursors := jsonb_set(
      v_next_cursors,
      ARRAY[v_interleaved_record.channel_id::TEXT],
      jsonb_build_object(
        'published_at', v_interleaved_record.published_at,
        'id', v_interleaved_record.id
      )
    );
  END LOOP;

  -- Check if candidate table still has remaining unconsumed rows
  IF (SELECT COUNT(*) FROM tmp_feed_candidates) > jsonb_array_length(v_result_videos) THEN
    v_has_more := true;
  END IF;

  RETURN jsonb_build_object(
    'videos', v_result_videos,
    'has_more', v_has_more,
    'next_cursors', v_next_cursors
  );
END;
$$;
