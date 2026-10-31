-- Migration 017: Ensure author_name and author_role exist on short_comments
ALTER TABLE public.short_comments ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.short_comments ADD COLUMN IF NOT EXISTS author_role TEXT NOT NULL DEFAULT 'child';

