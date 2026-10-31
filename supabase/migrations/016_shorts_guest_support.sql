-- Migration 016: Support Guest viewing in get_shorts_feed while preserving strict family isolation for authenticated users

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
    rv.channel_title,
    rv.channel_thumbnail_url,
    CASE WHEN v_current_user IS NOT NULL THEN
      EXISTS(SELECT 1 FROM public.short_likes sl WHERE sl.video_id = rv.id AND sl.user_id = v_current_user)
    ELSE false END AS is_liked,
    CASE WHEN v_current_user IS NOT NULL THEN
      EXISTS(SELECT 1 FROM public.short_saves ss WHERE ss.video_id = rv.id AND ss.user_id = v_current_user)
    ELSE false END AS is_saved,
    (SELECT COUNT(*)::int FROM public.short_likes sl WHERE sl.video_id = rv.id) AS family_like_count,
    CASE WHEN v_family_id IS NOT NULL THEN
      (SELECT COUNT(*)::int FROM public.short_comments sc WHERE sc.video_id = rv.id AND sc.family_id = v_family_id AND sc.deleted_at IS NULL)
    ELSE 0 END AS family_comment_count,
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

GRANT EXECUTE ON FUNCTION public.get_shorts_feed(INT, INT, INT) TO anon, authenticated, service_role;

