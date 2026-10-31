-- Migration 014: Shorts Rewrite — Schema, Indexes, RLS, RPCs, and Backfill

-- 1. ADD COLUMNS TO CHANNELS
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS shorts_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS shorts_limit INT DEFAULT 50;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS shorts_total_count INT NOT NULL DEFAULT 0;

-- 2. ADD COLUMN TO PROFILES FOR CHILD COMMENTING PERMISSION
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_child_comments BOOLEAN NOT NULL DEFAULT true;

-- 3. SHORT LIKES TABLE (Family scoped engagement)
CREATE TABLE IF NOT EXISTS public.short_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- 4. SHORT SAVES TABLE
CREATE TABLE IF NOT EXISTS public.short_saves (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- 5. SHORT COMMENTS TABLE (Family-scoped, with moderation)
CREATE TABLE IF NOT EXISTS public.short_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT 'child',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 6. SHORT VIEWS TABLE (Watch history & 50% seen threshold)
CREATE TABLE IF NOT EXISTS public.short_views (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  max_progress_percent INT NOT NULL DEFAULT 0,
  watched_seconds INT NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_videos_channel_short_pub ON public.videos(channel_id, is_short, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_short_likes_video ON public.short_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_short_saves_user ON public.short_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_short_comments_video_active ON public.short_comments(video_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_short_comments_family ON public.short_comments(family_id);
CREATE INDEX IF NOT EXISTS idx_short_views_user_progress ON public.short_views(user_id, max_progress_percent);
CREATE INDEX IF NOT EXISTS idx_short_views_user_last_watched ON public.short_views(user_id, last_watched_at DESC);

-- 8. HELPER FUNCTION: RESOLVE CALLER'S FAMILY ID
CREATE OR REPLACE FUNCTION public.get_auth_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'parent_id', '')::uuid,
    NULLIF(auth.jwt() ->> 'parent_id', '')::uuid,
    (SELECT parent_id FROM public.children WHERE id = auth.uid()),
    auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_family_id() TO authenticated, service_role;

-- 9. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.short_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_views ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES

-- short_likes
DROP POLICY IF EXISTS "short_likes_select_family" ON public.short_likes;
DROP POLICY IF EXISTS "short_likes_insert_own" ON public.short_likes;
DROP POLICY IF EXISTS "short_likes_delete_own" ON public.short_likes;

CREATE POLICY "short_likes_select_family" ON public.short_likes
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.videos v
      JOIN public.channels c ON c.id = v.channel_id
      WHERE v.id = short_likes.video_id
        AND c.parent_id = public.get_auth_family_id()
    )
  );

CREATE POLICY "short_likes_insert_own" ON public.short_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "short_likes_delete_own" ON public.short_likes
  FOR DELETE USING (auth.uid() = user_id);

-- short_saves
DROP POLICY IF EXISTS "short_saves_select_own" ON public.short_saves;
DROP POLICY IF EXISTS "short_saves_insert_own" ON public.short_saves;
DROP POLICY IF EXISTS "short_saves_delete_own" ON public.short_saves;

CREATE POLICY "short_saves_select_own" ON public.short_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "short_saves_insert_own" ON public.short_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "short_saves_delete_own" ON public.short_saves
  FOR DELETE USING (auth.uid() = user_id);

-- short_comments (Never leak across families; parent can moderate all)
DROP POLICY IF EXISTS "short_comments_select_family" ON public.short_comments;
DROP POLICY IF EXISTS "short_comments_insert_family" ON public.short_comments;
DROP POLICY IF EXISTS "short_comments_update_moderation" ON public.short_comments;
DROP POLICY IF EXISTS "short_comments_delete_moderation" ON public.short_comments;

CREATE POLICY "short_comments_select_family" ON public.short_comments
  FOR SELECT USING (
    family_id = public.get_auth_family_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "short_comments_insert_family" ON public.short_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND family_id = public.get_auth_family_id()
  );

CREATE POLICY "short_comments_update_moderation" ON public.short_comments
  FOR UPDATE USING (
    family_id = public.get_auth_family_id()
    AND (
      auth.uid() = user_id
      OR public.get_auth_family_id() = auth.uid()
    )
  );

CREATE POLICY "short_comments_delete_moderation" ON public.short_comments
  FOR DELETE USING (
    family_id = public.get_auth_family_id()
    AND (
      auth.uid() = user_id
      OR public.get_auth_family_id() = auth.uid()
    )
  );

-- short_views
DROP POLICY IF EXISTS "short_views_select_own" ON public.short_views;
DROP POLICY IF EXISTS "short_views_insert_own" ON public.short_views;
DROP POLICY IF EXISTS "short_views_update_own" ON public.short_views;
DROP POLICY IF EXISTS "short_views_delete_own" ON public.short_views;

CREATE POLICY "short_views_select_own" ON public.short_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "short_views_insert_own" ON public.short_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "short_views_update_own" ON public.short_views
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "short_views_delete_own" ON public.short_views
  FOR DELETE USING (auth.uid() = user_id);

-- 11. RPC: GET SHORTS FEED
-- Server-side round-robin interleaving, 50% seen threshold, per-channel shorts_limit
CREATE OR REPLACE FUNCTION public.get_shorts_feed(
  p_seed INT DEFAULT 123456,
  p_cursor INT DEFAULT 0,
  p_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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

  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object(
      'videos', '[]'::JSONB,
      'has_more', false,
      'next_cursor', null,
      'total', 0
    );
  END IF;

  -- Temporary candidate table for round-robin interleaving
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
    channel_title TEXT,
    channel_thumbnail_url TEXT,
    is_liked BOOLEAN,
    is_saved BOOLEAN,
    family_like_count INT,
    family_comment_count INT,
    channel_rank INT,
    row_within_channel INT
  ) ON COMMIT DROP;

  TRUNCATE tmp_shorts_candidates;

  -- Insert eligible videos adhering to shorts_enabled, shorts_limit, and NOT watched >= 50%
  INSERT INTO tmp_shorts_candidates (
    id, channel_id, youtube_video_id, title, thumbnail_url,
    duration_seconds, view_count, is_short, published_at,
    channel_title, channel_thumbnail_url,
    is_liked, is_saved, family_like_count, family_comment_count,
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
    WHERE c.parent_id = v_family_id
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
    WHERE v.is_short = true
      -- Exclusion: Short watched >= 50% by this user is omitted
      AND NOT EXISTS (
        SELECT 1 FROM public.short_views sv
        WHERE sv.user_id = v_current_user
          AND sv.video_id = v.id
          AND sv.max_progress_percent >= 50
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
    rv.channel_title,
    rv.channel_thumbnail_url,
    EXISTS(SELECT 1 FROM public.short_likes sl WHERE sl.video_id = rv.id AND sl.user_id = v_current_user) AS is_liked,
    EXISTS(SELECT 1 FROM public.short_saves ss WHERE ss.video_id = rv.id AND ss.user_id = v_current_user) AS is_saved,
    (SELECT COUNT(*)::int FROM public.short_likes sl WHERE sl.video_id = rv.id) AS family_like_count,
    (SELECT COUNT(*)::int FROM public.short_comments sc WHERE sc.video_id = rv.id AND sc.family_id = v_family_id AND sc.deleted_at IS NULL) AS family_comment_count,
    rv.channel_rank,
    rv.row_within_channel
  FROM ranked_videos rv
  WHERE rv.shorts_limit IS NULL OR rv.row_within_channel <= rv.shorts_limit;

  SELECT COUNT(*) INTO v_total_eligible FROM tmp_shorts_candidates;

  -- Select slice using round-robin order: row_within_channel ASC, channel_rank ASC
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
      'channel', jsonb_build_object(
        'id', t.channel_id,
        'title', t.channel_title,
        'thumbnail_url', t.channel_thumbnail_url
      ),
      'channelName', t.channel_title,
      'channelAvatarUrl', t.channel_thumbnail_url,
      'is_liked', t.is_liked,
      'is_saved', t.is_saved,
      'family_like_count', t.family_like_count,
      'family_comment_count', t.family_comment_count
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

GRANT EXECUTE ON FUNCTION public.get_shorts_feed(INT, INT, INT) TO authenticated;

-- 12. RPC: TOGGLE SHORT LIKE
CREATE OR REPLACE FUNCTION public.toggle_short_like(p_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
  v_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.short_likes WHERE user_id = v_user_id AND video_id = p_video_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.short_likes WHERE user_id = v_user_id AND video_id = p_video_id;
  ELSE
    INSERT INTO public.short_likes (user_id, video_id)
    VALUES (v_user_id, p_video_id)
    ON CONFLICT (user_id, video_id) DO NOTHING;
  END IF;

  SELECT COUNT(*)::int INTO v_count FROM public.short_likes WHERE video_id = p_video_id;

  RETURN jsonb_build_object(
    'liked', NOT v_exists,
    'like_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_short_like(UUID) TO authenticated;

-- 13. RPC: TOGGLE SHORT SAVE
CREATE OR REPLACE FUNCTION public.toggle_short_save(p_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.short_saves WHERE user_id = v_user_id AND video_id = p_video_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.short_saves WHERE user_id = v_user_id AND video_id = p_video_id;
  ELSE
    INSERT INTO public.short_saves (user_id, video_id)
    VALUES (v_user_id, p_video_id)
    ON CONFLICT (user_id, video_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('saved', NOT v_exists);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_short_save(UUID) TO authenticated;

-- 14. RPC: ADD SHORT COMMENT (With length check, rate limit, and parent moderation toggle)
CREATE OR REPLACE FUNCTION public.add_short_comment(
  p_video_id UUID,
  p_body TEXT,
  p_author_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_auth_family_id();
  v_role TEXT := 'child';
  v_allow_comments BOOLEAN := true;
  v_recent_count INT := 0;
  v_clean_body TEXT;
  v_author_display TEXT;
  v_new_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_body := trim(p_body);
  IF length(v_clean_body) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  IF length(v_clean_body) > 140 THEN
    RAISE EXCEPTION 'Comment exceeds maximum length of 140 characters';
  END IF;

  -- Determine role
  IF v_user_id = v_family_id THEN
    v_role := 'parent';
  ELSE
    v_role := 'child';
  END IF;

  -- Check if children are allowed to comment
  IF v_role = 'child' THEN
    SELECT COALESCE(allow_child_comments, true) INTO v_allow_comments
    FROM public.profiles
    WHERE id = v_family_id;

    IF NOT v_allow_comments THEN
      RAISE EXCEPTION 'Child commenting is disabled by parental controls';
    END IF;

    -- Rate limiting: max 5 comments per minute per user
    SELECT COUNT(*) INTO v_recent_count
    FROM public.short_comments
    WHERE user_id = v_user_id
      AND created_at > (now() - INTERVAL '1 minute');

    IF v_recent_count >= 5 THEN
      RAISE EXCEPTION 'Slow down! Please wait a moment before commenting again.';
    END IF;
  END IF;

  -- Resolve author name
  v_author_display := trim(p_author_name);
  IF length(v_author_display) = 0 THEN
    IF v_role = 'parent' THEN
      SELECT full_name INTO v_author_display FROM public.profiles WHERE id = v_user_id;
    ELSE
      SELECT display_name INTO v_author_display FROM public.children WHERE id = v_user_id;
    END IF;
  END IF;
  v_author_display := COALESCE(NULLIF(v_author_display, ''), CASE WHEN v_role = 'parent' THEN 'Parent' ELSE 'Friend' END);

  INSERT INTO public.short_comments (
    video_id, family_id, user_id, author_name, author_role, body
  )
  VALUES (
    p_video_id, v_family_id, v_user_id, v_author_display, v_role, v_clean_body
  )
  RETURNING id, created_at INTO v_new_id, v_created_at;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'video_id', p_video_id,
    'family_id', v_family_id,
    'user_id', v_user_id,
    'author_name', v_author_display,
    'author_role', v_role,
    'body', v_clean_body,
    'created_at', v_created_at,
    'can_delete', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_short_comment(UUID, TEXT, TEXT) TO authenticated;

-- 15. RPC: LIST SHORT COMMENTS (Family isolated)
CREATE OR REPLACE FUNCTION public.list_short_comments(p_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_auth_family_id();
  v_is_parent BOOLEAN;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  v_is_parent := (v_user_id = v_family_id);

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sc.id,
      'video_id', sc.video_id,
      'user_id', sc.user_id,
      'author_name', sc.author_name,
      'author_role', sc.author_role,
      'body', sc.body,
      'created_at', sc.created_at,
      'can_delete', (v_is_parent OR sc.user_id = v_user_id)
    )
    ORDER BY sc.created_at ASC
  )
  INTO v_result
  FROM public.short_comments sc
  WHERE sc.video_id = p_video_id
    AND sc.family_id = v_family_id
    AND sc.deleted_at IS NULL;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_short_comments(UUID) TO authenticated;

-- 16. RPC: DELETE SHORT COMMENT (Parent or Author)
CREATE OR REPLACE FUNCTION public.delete_short_comment(p_comment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_auth_family_id();
  v_comment RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_comment FROM public.short_comments WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  -- Verification: user must be in same family AND (be the parent OR author)
  IF v_comment.family_id <> v_family_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_user_id <> v_family_id AND v_user_id <> v_comment.user_id THEN
    RAISE EXCEPTION 'Only parents or the comment author can delete this comment';
  END IF;

  UPDATE public.short_comments
  SET deleted_at = now()
  WHERE id = p_comment_id;

  RETURN jsonb_build_object('success', true, 'comment_id', p_comment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_short_comment(UUID) TO authenticated;

-- 17. RPC: RECORD SHORT PROGRESS
CREATE OR REPLACE FUNCTION public.record_short_progress(
  p_video_id UUID,
  p_watched_seconds INT,
  p_progress_percent INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bounded_pct INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_bounded_pct := LEAST(100, GREATEST(0, p_progress_percent));

  INSERT INTO public.short_views (
    user_id, video_id, max_progress_percent, watched_seconds, last_watched_at
  )
  VALUES (
    v_user_id, p_video_id, v_bounded_pct, GREATEST(0, p_watched_seconds), now()
  )
  ON CONFLICT (user_id, video_id) DO UPDATE
  SET
    max_progress_percent = GREATEST(public.short_views.max_progress_percent, v_bounded_pct),
    watched_seconds = public.short_views.watched_seconds + GREATEST(0, p_watched_seconds),
    last_watched_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_short_progress(UUID, INT, INT) TO authenticated;

-- 18. RPC: UPDATE CHANNEL SHORTS SETTINGS (Parent Only)
CREATE OR REPLACE FUNCTION public.update_channel_shorts_settings(
  p_channel_id UUID,
  p_shorts_enabled BOOLEAN,
  p_shorts_limit INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.channels
  SET
    shorts_enabled = p_shorts_enabled,
    shorts_limit = p_shorts_limit
  WHERE id = p_channel_id
    AND parent_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found or unauthorized';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_channel_shorts_settings(UUID, BOOLEAN, INT) TO authenticated;

-- 19. RPC: RESET SHORTS HISTORY (Parent Only Replay Action)
CREATE OR REPLACE FUNCTION public.reset_shorts_history()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.short_views WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'reset_count', v_deleted_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_shorts_history() TO authenticated;

-- 20. ONE-TIME BACKFILL: COMPUTE shorts_total_count FOR ALL EXISTING CHANNELS
UPDATE public.channels c
SET
  shorts_total_count = COALESCE((
    SELECT COUNT(*)::int
    FROM public.videos v
    WHERE v.channel_id = c.id
      AND v.is_short = true
  ), 0),
  shorts_enabled = COALESCE(c.shorts_enabled, true),
  shorts_limit = COALESCE(c.shorts_limit, 50);

