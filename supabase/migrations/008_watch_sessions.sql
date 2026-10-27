-- Migration 008: Watch-Time Analytics — four tables, RLS policies, indexes, and transactional RPC

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: watch_sessions
-- One row per (child_id, video_id). Upserted on every heartbeat.
-- Stores cumulative watched seconds, absolute playback position, and is the
-- source of truth for the paginated Watch History feed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watch_sessions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id              UUID        NOT NULL,    -- denormalized from children.parent_id for cheap RLS
  video_id               UUID        NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  channel_id             UUID        NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  watched_seconds        INT         NOT NULL DEFAULT 0,
  video_duration_seconds INT         NOT NULL DEFAULT 0,
  progress_percent       INT         NOT NULL DEFAULT 0,   -- 0–100, derived, maintained on write
  absolute_position      FLOAT       NOT NULL DEFAULT 0,   -- last known playback position in seconds
  last_watched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_beat_at           TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01',  -- idempotency guard
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watch_sessions_unique_child_video UNIQUE (child_id, video_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: child_watch_totals
-- One row per child. Lifetime seconds. Single PK lookup = O(1) read.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.child_watch_totals (
  child_id          UUID   PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id         UUID   NOT NULL,
  lifetime_seconds  BIGINT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: child_watch_daily
-- One row per (child_id, watch_date). Composite PK = O(1) single-date read.
-- "Today's watch time" is a single indexed lookup, never a scan.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.child_watch_daily (
  child_id        UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id       UUID  NOT NULL,
  watch_date      DATE  NOT NULL,
  seconds_watched INT   NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, watch_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: child_channel_watch_totals
-- One row per (child_id, channel_id). Top-channels ranking is an indexed
-- ORDER BY — no GROUP BY / SUM over raw rows ever needed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.child_channel_watch_totals (
  child_id      UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     UUID   NOT NULL,
  channel_id    UUID   NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  total_seconds BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, channel_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- History cursor pagination: WHERE child_id = $1 ORDER BY last_watched_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_watch_sessions_child_last_watched
  ON public.watch_sessions (child_id, last_watched_at DESC, id DESC);

-- Bulk "today's watch time for parent's children" list query
CREATE INDEX IF NOT EXISTS idx_child_watch_daily_parent_date
  ON public.child_watch_daily (parent_id, watch_date);

-- Top-channels ORDER BY without runtime sort
CREATE INDEX IF NOT EXISTS idx_child_channel_watch_totals_child_seconds
  ON public.child_channel_watch_totals (child_id, total_seconds DESC);

-- Parent can read all sessions for their children efficiently
CREATE INDEX IF NOT EXISTS idx_watch_sessions_parent_id
  ON public.watch_sessions (parent_id);

CREATE INDEX IF NOT EXISTS idx_child_watch_totals_parent_id
  ON public.child_watch_totals (parent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.watch_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_watch_totals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_watch_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_channel_watch_totals ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — watch_sessions
-- Child: read/write own rows only.
-- Parent: read-only for any of their children's rows.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ws_child_own_read"   ON public.watch_sessions;
DROP POLICY IF EXISTS "ws_child_own_write"  ON public.watch_sessions;
DROP POLICY IF EXISTS "ws_parent_read"      ON public.watch_sessions;

CREATE POLICY "ws_child_own_read" ON public.watch_sessions
  FOR SELECT USING (
    child_id = auth.uid()
    AND (auth.jwt() ->> 'role') = 'child'
  );

CREATE POLICY "ws_child_own_write" ON public.watch_sessions
  FOR ALL USING (
    child_id = auth.uid()
    AND (auth.jwt() ->> 'role') = 'child'
  );

CREATE POLICY "ws_parent_read" ON public.watch_sessions
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'parent'
    AND parent_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — child_watch_totals
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cwt_child_own"     ON public.child_watch_totals;
DROP POLICY IF EXISTS "cwt_parent_read"   ON public.child_watch_totals;

CREATE POLICY "cwt_child_own" ON public.child_watch_totals
  FOR ALL USING (
    child_id = auth.uid()
    AND (auth.jwt() ->> 'role') = 'child'
  );

CREATE POLICY "cwt_parent_read" ON public.child_watch_totals
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'parent'
    AND parent_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — child_watch_daily
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cwd_child_own"     ON public.child_watch_daily;
DROP POLICY IF EXISTS "cwd_parent_read"   ON public.child_watch_daily;

CREATE POLICY "cwd_child_own" ON public.child_watch_daily
  FOR ALL USING (
    child_id = auth.uid()
    AND (auth.jwt() ->> 'role') = 'child'
  );

CREATE POLICY "cwd_parent_read" ON public.child_watch_daily
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'parent'
    AND parent_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — child_channel_watch_totals
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ccwt_child_own"    ON public.child_channel_watch_totals;
DROP POLICY IF EXISTS "ccwt_parent_read"  ON public.child_channel_watch_totals;

CREATE POLICY "ccwt_child_own" ON public.child_channel_watch_totals
  FOR ALL USING (
    child_id = auth.uid()
    AND (auth.jwt() ->> 'role') = 'child'
  );

CREATE POLICY "ccwt_parent_read" ON public.child_channel_watch_totals
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'parent'
    AND parent_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TRANSACTIONAL WRITE RPC: record_watch_progress
--
-- Called by the record-watch-progress Edge Function (SECURITY DEFINER so it
-- bypasses RLS; auth is validated in the Edge Function before calling this).
-- All four upserts run in one implicit plpgsql transaction — no partial writes.
-- Idempotency: skips if p_beat_timestamp <= existing last_beat_at.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_watch_progress(
  p_child_id          UUID,
  p_parent_id         UUID,
  p_video_id          UUID,
  p_channel_id        UUID,
  p_delta_seconds     INT,
  p_absolute_position FLOAT,
  p_video_duration    INT,
  p_beat_timestamp    TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_beat TIMESTAMPTZ;
  v_existing_watched INT;
  v_new_watched INT;
  v_progress INT;
BEGIN
  -- Guard: delta must be positive to do anything meaningful
  IF p_delta_seconds <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'zero_delta');
  END IF;

  -- ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
  -- If this exact beat timestamp (or a later one) was already applied, skip.
  SELECT last_beat_at, watched_seconds
    INTO v_existing_beat, v_existing_watched
    FROM public.watch_sessions
   WHERE child_id = p_child_id AND video_id = p_video_id;

  IF FOUND AND p_beat_timestamp <= v_existing_beat THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'duplicate_beat');
  END IF;

  -- ── COMPUTE NEW WATCHED SECONDS ───────────────────────────────────────────
  -- Additive delta. If row doesn't exist yet, v_existing_watched is NULL → treat as 0.
  v_new_watched := COALESCE(v_existing_watched, 0) + p_delta_seconds;
  -- Cap at video duration to avoid over-counting due to seek loops
  IF p_video_duration > 0 THEN
    v_new_watched := LEAST(v_new_watched, p_video_duration);
  END IF;

  -- Compute progress percent
  IF p_video_duration > 0 THEN
    v_progress := LEAST(100, FLOOR(v_new_watched::FLOAT / p_video_duration * 100));
  ELSE
    v_progress := 0;
  END IF;

  -- ── UPSERT 1: watch_sessions ──────────────────────────────────────────────
  INSERT INTO public.watch_sessions (
    child_id, parent_id, video_id, channel_id,
    watched_seconds, video_duration_seconds, progress_percent,
    absolute_position, last_watched_at, last_beat_at
  ) VALUES (
    p_child_id, p_parent_id, p_video_id, p_channel_id,
    v_new_watched, p_video_duration, v_progress,
    p_absolute_position, NOW(), p_beat_timestamp
  )
  ON CONFLICT (child_id, video_id) DO UPDATE SET
    watched_seconds        = v_new_watched,
    video_duration_seconds = p_video_duration,
    progress_percent       = v_progress,
    absolute_position      = p_absolute_position,
    last_watched_at        = NOW(),
    last_beat_at           = p_beat_timestamp,
    -- Keep the original channel_id in case it was set correctly first
    channel_id             = EXCLUDED.channel_id;

  -- ── UPSERT 2: child_watch_totals (lifetime) ───────────────────────────────
  INSERT INTO public.child_watch_totals (child_id, parent_id, lifetime_seconds)
  VALUES (p_child_id, p_parent_id, p_delta_seconds)
  ON CONFLICT (child_id) DO UPDATE SET
    lifetime_seconds = child_watch_totals.lifetime_seconds + p_delta_seconds;

  -- ── UPSERT 3: child_watch_daily (today's bucket) ─────────────────────────
  INSERT INTO public.child_watch_daily (child_id, parent_id, watch_date, seconds_watched)
  VALUES (p_child_id, p_parent_id, CURRENT_DATE, p_delta_seconds)
  ON CONFLICT (child_id, watch_date) DO UPDATE SET
    seconds_watched = child_watch_daily.seconds_watched + p_delta_seconds;

  -- ── UPSERT 4: child_channel_watch_totals ─────────────────────────────────
  INSERT INTO public.child_channel_watch_totals (child_id, parent_id, channel_id, total_seconds)
  VALUES (p_child_id, p_parent_id, p_channel_id, p_delta_seconds)
  ON CONFLICT (child_id, channel_id) DO UPDATE SET
    total_seconds = child_channel_watch_totals.total_seconds + p_delta_seconds;

  RETURN jsonb_build_object('ok', true, 'watched_seconds', v_new_watched, 'progress_percent', v_progress);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_watch_progress TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- READ RPC: get_child_watch_summary
-- Returns lifetime total + today total + top-5 channels in one call.
-- SECURITY INVOKER — inherits caller's RLS automatically.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_child_watch_summary(p_child_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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

  -- Top 5 channels — index scan, ORDER BY total_seconds DESC, LIMIT 5
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
    'lifetime_seconds',   v_lifetime,
    'today_seconds',      v_today,
    'top_channels',       COALESCE(v_top_channels, '[]'::JSONB),
    'total_channel_count', v_channel_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_child_watch_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- READ RPC: get_child_watch_channels (full channel list, no LIMIT)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_child_watch_channels(p_child_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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

GRANT EXECUTE ON FUNCTION public.get_child_watch_channels TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- READ RPC: get_child_watch_history (cursor-paginated, 30/batch)
-- Cursor = { last_watched_at, id } — same keyset pattern as the feed RPC.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_child_watch_history(
  p_child_id      UUID,
  p_limit         INT    DEFAULT 30,
  p_cursor_time   TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id     UUID   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_sessions JSONB   := '[]'::JSONB;
  v_has_more BOOLEAN := false;
  v_next_time TIMESTAMPTZ;
  v_next_id   UUID;
  v_count     INT;
BEGIN
  -- Fetch limit+1 to detect has_more
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

  -- Detect has_more
  IF v_count > p_limit THEN
    v_has_more := true;
    -- Trim the extra probe row from the result
    v_sessions := (
      SELECT jsonb_agg(elem ORDER BY (elem->>'last_watched_at') DESC)
      FROM (
        SELECT elem FROM jsonb_array_elements(v_sessions) WITH ORDINALITY AS t(elem, ord)
        WHERE ord <= p_limit
      ) sub
    );
  END IF;

  -- Compute next cursor from the last item
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

GRANT EXECUTE ON FUNCTION public.get_child_watch_history TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- READ RPC: get_children_today_summary
-- Returns today's watch seconds for ALL of a parent's children in one query.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_children_today_summary(p_parent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
BEGIN
  -- Left-join so children with no watch data still appear with 0
  SELECT jsonb_agg(
    jsonb_build_object(
      'child_id', ch.id,
      'seconds',  COALESCE(cwd.seconds_watched, 0)
    )
  )
  INTO v_result
  FROM public.children ch
  LEFT JOIN public.child_watch_daily cwd
    ON cwd.child_id = ch.id AND cwd.watch_date = CURRENT_DATE
  WHERE ch.parent_id = p_parent_id;

  RETURN jsonb_build_object('today', COALESCE(v_result, '[]'::JSONB));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_children_today_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- READ RPC: get_child_watch_resume_position
-- Called by the video playback page to get the saved absolute_position for
-- a (child, video) pair so playback can resume where the child left off.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_child_watch_resume_position(
  p_child_id UUID,
  p_video_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_position FLOAT := 0;
  v_percent  INT   := 0;
BEGIN
  SELECT absolute_position, progress_percent
    INTO v_position, v_percent
    FROM public.watch_sessions
   WHERE child_id = p_child_id AND video_id = p_video_id;

  RETURN jsonb_build_object(
    'absolute_position', COALESCE(v_position, 0),
    'progress_percent',  COALESCE(v_percent, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_child_watch_resume_position TO authenticated;
