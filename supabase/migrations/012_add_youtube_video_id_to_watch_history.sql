-- Migration 012: Add youtube_video_id to get_child_watch_history RPC
-- Allows frontend watch history navigation to directly open the video with its YouTube ID.

CREATE OR REPLACE FUNCTION public.get_child_watch_history(
  p_child_id      UUID,
  p_limit         INT         DEFAULT 30,
  p_cursor_time   TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id     UUID        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessions JSONB   := '[]'::JSONB;
  v_has_more BOOLEAN := false;
  v_next_time TIMESTAMPTZ;
  v_next_id   UUID;
  v_count     INT;
BEGIN
  WITH candidates AS (
    SELECT
      ws.id,
      ws.video_id,
      v.youtube_video_id,
      ws.channel_id,
      ws.watched_seconds,
      ws.video_duration_seconds,
      ws.progress_percent,
      ws.absolute_position,
      ws.last_watched_at,
      v.title       AS video_title,
      v.thumbnail_url AS video_thumbnail,
      c.title       AS channel_name
    FROM public.watch_sessions ws
    JOIN public.videos   v ON v.id = ws.video_id
    JOIN public.channels c ON c.id = ws.channel_id
    WHERE ws.child_id = p_child_id
      AND (
        p_cursor_time IS NULL
        OR ws.last_watched_at < p_cursor_time
        OR (ws.last_watched_at = p_cursor_time AND ws.id < p_cursor_id)
      )
    ORDER BY ws.last_watched_at DESC, ws.id DESC
    LIMIT p_limit + 1
  )
  SELECT
    COUNT(*),
    jsonb_agg(
      jsonb_build_object(
        'id',                    id,
        'video_id',              video_id,
        'youtube_video_id',      youtube_video_id,
        'channel_id',            channel_id,
        'watched_seconds',       watched_seconds,
        'video_duration_seconds', video_duration_seconds,
        'progress_percent',      progress_percent,
        'absolute_position',     absolute_position,
        'last_watched_at',       last_watched_at,
        'video_title',           video_title,
        'video_thumbnail',       video_thumbnail,
        'channel_name',          channel_name
      ) ORDER BY last_watched_at DESC, id DESC
    )
  INTO v_count, v_sessions
  FROM candidates;

  IF v_count > p_limit THEN
    v_has_more := true;
    v_sessions := (
      SELECT jsonb_agg(elem ORDER BY (elem->>'last_watched_at') DESC)
      FROM (
        SELECT elem FROM jsonb_array_elements(v_sessions) WITH ORDINALITY AS t(elem, ord)
        WHERE ord <= p_limit
      ) sub
    );
  END IF;

  IF jsonb_array_length(COALESCE(v_sessions, '[]'::JSONB)) > 0 THEN
    v_next_time := (v_sessions -> (jsonb_array_length(v_sessions) - 1) ->> 'last_watched_at')::TIMESTAMPTZ;
    v_next_id   := (v_sessions -> (jsonb_array_length(v_sessions) - 1) ->> 'id')::UUID;
  END IF;

  RETURN jsonb_build_object(
    'sessions',    COALESCE(v_sessions, '[]'::JSONB),
    'has_more',    v_has_more,
    'next_cursor', CASE WHEN v_has_more THEN
      jsonb_build_object('last_watched_at', v_next_time, 'id', v_next_id)
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_child_watch_history(UUID, INT, TIMESTAMPTZ, UUID) TO authenticated, service_role, anon;
