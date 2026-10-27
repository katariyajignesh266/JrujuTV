-- Migration 009: Make watch analytics RPC functions SECURITY DEFINER and broaden RLS policies

-- 1. Update RLS policies to allow parent read by parent_id match or children table match
DROP POLICY IF EXISTS "ws_child_own_read"   ON public.watch_sessions;
DROP POLICY IF EXISTS "ws_child_own_write"  ON public.watch_sessions;
DROP POLICY IF EXISTS "ws_parent_read"      ON public.watch_sessions;

CREATE POLICY "ws_child_own_read" ON public.watch_sessions
  FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "ws_child_own_write" ON public.watch_sessions
  FOR ALL USING (child_id = auth.uid());

CREATE POLICY "ws_parent_read" ON public.watch_sessions
  FOR SELECT USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children WHERE children.id = watch_sessions.child_id AND children.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "cwt_child_own"     ON public.child_watch_totals;
DROP POLICY IF EXISTS "cwt_parent_read"   ON public.child_watch_totals;

CREATE POLICY "cwt_child_own" ON public.child_watch_totals
  FOR ALL USING (child_id = auth.uid());

CREATE POLICY "cwt_parent_read" ON public.child_watch_totals
  FOR SELECT USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children WHERE children.id = child_watch_totals.child_id AND children.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "cwd_child_own"     ON public.child_watch_daily;
DROP POLICY IF EXISTS "cwd_parent_read"   ON public.child_watch_daily;

CREATE POLICY "cwd_child_own" ON public.child_watch_daily
  FOR ALL USING (child_id = auth.uid());

CREATE POLICY "cwd_parent_read" ON public.child_watch_daily
  FOR SELECT USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children WHERE children.id = child_watch_daily.child_id AND children.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "ccwt_child_own"    ON public.child_channel_watch_totals;
DROP POLICY IF EXISTS "ccwt_parent_read"  ON public.child_channel_watch_totals;

CREATE POLICY "ccwt_child_own" ON public.child_channel_watch_totals
  FOR ALL USING (child_id = auth.uid());

CREATE POLICY "ccwt_parent_read" ON public.child_channel_watch_totals
  FOR SELECT USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children WHERE children.id = child_channel_watch_totals.child_id AND children.parent_id = auth.uid())
  );

-- 2. Make RPC functions SECURITY DEFINER so they are fast and not dependent on caller session RLS nuances
CREATE OR REPLACE FUNCTION public.get_child_watch_summary(p_child_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifetime       BIGINT := 0;
  v_today          INT    := 0;
  v_channel_count  INT    := 0;
  v_top_channels   JSONB  := '[]'::JSONB;
BEGIN
  -- Lifetime total (PK lookup)
  SELECT COALESCE(lifetime_seconds, 0) INTO v_lifetime
    FROM public.child_watch_totals
   WHERE child_id = p_child_id;

  -- Today's total (composite PK lookup)
  SELECT COALESCE(seconds_watched, 0) INTO v_today
    FROM public.child_watch_daily
   WHERE child_id = p_child_id AND watch_date = CURRENT_DATE;

  -- Total distinct channels
  SELECT COUNT(*) INTO v_channel_count
    FROM public.child_channel_watch_totals
   WHERE child_id = p_child_id;

  -- Top 5 channels
  SELECT jsonb_agg(
    jsonb_build_object(
      'channel_id',        ccwt.channel_id,
      'channel_name',      c.title,
      'channel_thumbnail', c.thumbnail_url,
      'total_seconds',     ccwt.total_seconds
    ) ORDER BY ccwt.total_seconds DESC
  )
  INTO v_top_channels
  FROM (
    SELECT channel_id, total_seconds
      FROM public.child_channel_watch_totals
     WHERE child_id = p_child_id
     ORDER BY total_seconds DESC
     LIMIT 5
  ) ccwt
  JOIN public.channels c ON c.id = ccwt.channel_id;

  RETURN jsonb_build_object(
    'lifetime_seconds',   COALESCE(v_lifetime, 0),
    'today_seconds',      COALESCE(v_today, 0),
    'top_channels',       COALESCE(v_top_channels, '[]'::JSONB),
    'total_channel_count', COALESCE(v_channel_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_child_watch_channels(p_child_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channels JSONB := '[]'::JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'channel_id',        ccwt.channel_id,
      'channel_name',      c.title,
      'channel_thumbnail', c.thumbnail_url,
      'total_seconds',     ccwt.total_seconds
    ) ORDER BY ccwt.total_seconds DESC
  )
  INTO v_channels
  FROM public.child_channel_watch_totals ccwt
  JOIN public.channels c ON c.id = ccwt.channel_id
  WHERE ccwt.child_id = p_child_id;

  RETURN jsonb_build_object('channels', COALESCE(v_channels, '[]'::JSONB));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_child_watch_history(
  p_child_id      UUID,
  p_limit         INT    DEFAULT 30,
  p_cursor_time   TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id     UUID   DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.get_children_today_summary(p_parent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'child_id', cwd.child_id,
      'seconds',  cwd.seconds_watched
    )
  )
  INTO v_result
  FROM public.child_watch_daily cwd
  WHERE cwd.parent_id = p_parent_id
    AND cwd.watch_date = CURRENT_DATE;

  RETURN jsonb_build_object('today', COALESCE(v_result, '[]'::JSONB));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_child_watch_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_child_watch_channels TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_child_watch_history TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_children_today_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_watch_progress TO authenticated, service_role;
