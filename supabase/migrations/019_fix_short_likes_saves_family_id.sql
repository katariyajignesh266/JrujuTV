-- Migration 019: Fix family_id column constraints on short_likes and short_saves and update toggle RPCs

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'short_likes' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE public.short_likes ALTER COLUMN family_id DROP NOT NULL;
    ALTER TABLE public.short_likes ALTER COLUMN family_id SET DEFAULT public.get_auth_family_id();
  ELSE
    ALTER TABLE public.short_likes ADD COLUMN family_id UUID DEFAULT public.get_auth_family_id();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'short_saves' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE public.short_saves ALTER COLUMN family_id DROP NOT NULL;
    ALTER TABLE public.short_saves ALTER COLUMN family_id SET DEFAULT public.get_auth_family_id();
  ELSE
    ALTER TABLE public.short_saves ADD COLUMN family_id UUID DEFAULT public.get_auth_family_id();
  END IF;
END $$;

-- Update toggle_short_like with SECURITY DEFINER and family_id support
CREATE OR REPLACE FUNCTION public.toggle_short_like(p_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_auth_family_id();
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
    INSERT INTO public.short_likes (user_id, video_id, family_id)
    VALUES (v_user_id, p_video_id, v_family_id)
    ON CONFLICT (user_id, video_id) DO NOTHING;
  END IF;

  SELECT COUNT(*)::int INTO v_count FROM public.short_likes WHERE video_id = p_video_id;

  RETURN jsonb_build_object(
    'liked', NOT v_exists,
    'like_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_short_like(UUID) TO authenticated, service_role;

-- Update toggle_short_save with SECURITY DEFINER and family_id support
CREATE OR REPLACE FUNCTION public.toggle_short_save(p_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_auth_family_id();
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
    INSERT INTO public.short_saves (user_id, video_id, family_id)
    VALUES (v_user_id, p_video_id, v_family_id)
    ON CONFLICT (user_id, video_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('saved', NOT v_exists);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_short_save(UUID) TO authenticated, service_role;

