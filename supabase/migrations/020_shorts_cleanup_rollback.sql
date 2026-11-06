-- Rollback Migration for 020_shorts_cleanup.sql
-- Restores short_likes, short_saves, short_comments and related RPCs

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_child_comments BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.short_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

CREATE TABLE IF NOT EXISTS public.short_saves (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

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

ALTER TABLE public.short_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_comments ENABLE ROW LEVEL SECURITY;

COMMIT;

