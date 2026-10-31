-- Migration 018: Fix short_views family_id column constraint and record_short_progress RPC

-- 1. Make family_id nullable or default to get_auth_family_id() so missing family_id never breaks upserts
ALTER TABLE public.short_views ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE public.short_views ALTER COLUMN family_id SET DEFAULT public.get_auth_family_id();

-- 2. Update record_short_progress to populate family_id
CREATE OR REPLACE FUNCTION public.record_short_progress(
  p_video_id UUID,
  p_watched_seconds INT,
  p_progress_percent INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_auth_family_id();
  v_bounded_pct INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_bounded_pct := LEAST(100, GREATEST(0, p_progress_percent));

  INSERT INTO public.short_views (
    user_id, video_id, family_id, max_progress_percent, watched_seconds, last_watched_at
  )
  VALUES (
    v_user_id, p_video_id, v_family_id, v_bounded_pct, GREATEST(0, p_watched_seconds), now()
  )
  ON CONFLICT (user_id, video_id) DO UPDATE
  SET
    max_progress_percent = GREATEST(public.short_views.max_progress_percent, v_bounded_pct),
    watched_seconds = public.short_views.watched_seconds + GREATEST(0, p_watched_seconds),
    last_watched_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_short_progress(UUID, INT, INT) TO authenticated, service_role;

