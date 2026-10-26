-- Migration 003: Channels and Videos schema with RLS and constraints

-- CHANNELS TABLE
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    youtube_channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    subscriber_count BIGINT NOT NULL DEFAULT 0,
    video_count BIGINT NOT NULL DEFAULT 0,
    uploads_playlist_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ,
    CONSTRAINT channels_unique_per_parent UNIQUE (parent_id, youtube_channel_id)
);

-- VIDEOS TABLE
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    view_count BIGINT NOT NULL DEFAULT 0,
    is_short BOOLEAN NOT NULL GENERATED ALWAYS AS (duration_seconds <= 60) STORED,
    published_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT videos_unique_per_channel UNIQUE (channel_id, youtube_video_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_channels_parent_id ON public.channels(parent_id);
CREATE INDEX IF NOT EXISTS idx_channels_is_active ON public.channels(parent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON public.videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_short ON public.videos(channel_id, is_short);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos(channel_id, published_at DESC);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- DROP EXISTING POLICIES IF RE-RUNNING
DROP POLICY IF EXISTS "channels_select_parent" ON public.channels;
DROP POLICY IF EXISTS "channels_insert_parent" ON public.channels;
DROP POLICY IF EXISTS "channels_update_parent" ON public.channels;
DROP POLICY IF EXISTS "channels_delete_parent" ON public.channels;
DROP POLICY IF EXISTS "channels_select_child" ON public.channels;

DROP POLICY IF EXISTS "videos_select_parent" ON public.videos;
DROP POLICY IF EXISTS "videos_insert_parent" ON public.videos;
DROP POLICY IF EXISTS "videos_update_parent" ON public.videos;
DROP POLICY IF EXISTS "videos_delete_parent" ON public.videos;
DROP POLICY IF EXISTS "videos_select_child" ON public.videos;

-- CHANNELS POLICIES FOR PARENT
CREATE POLICY "channels_select_parent" ON public.channels
    FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "channels_insert_parent" ON public.channels
    FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "channels_update_parent" ON public.channels
    FOR UPDATE USING (auth.uid() = parent_id);

CREATE POLICY "channels_delete_parent" ON public.channels
    FOR DELETE USING (auth.uid() = parent_id);

-- CHANNELS POLICIES FOR CHILD (READ-ONLY)
CREATE POLICY "channels_select_child" ON public.channels
    FOR SELECT USING (
        parent_id = (CASE 
            WHEN (auth.jwt()->>'parent_id') IS NOT NULL AND (auth.jwt()->>'parent_id') != ''
            THEN (auth.jwt()->>'parent_id')::uuid 
            ELSE NULL 
        END)
        OR parent_id IN (SELECT parent_id FROM public.children WHERE id = auth.uid())
    );

-- VIDEOS POLICIES FOR PARENT
CREATE POLICY "videos_select_parent" ON public.videos
    FOR SELECT USING (
        channel_id IN (SELECT id FROM public.channels WHERE parent_id = auth.uid())
    );

CREATE POLICY "videos_insert_parent" ON public.videos
    FOR INSERT WITH CHECK (
        channel_id IN (SELECT id FROM public.channels WHERE parent_id = auth.uid())
    );

CREATE POLICY "videos_update_parent" ON public.videos
    FOR UPDATE USING (
        channel_id IN (SELECT id FROM public.channels WHERE parent_id = auth.uid())
    );

CREATE POLICY "videos_delete_parent" ON public.videos
    FOR DELETE USING (
        channel_id IN (SELECT id FROM public.channels WHERE parent_id = auth.uid())
    );

-- VIDEOS POLICIES FOR CHILD (READ-ONLY)
CREATE POLICY "videos_select_child" ON public.videos
    FOR SELECT USING (
        channel_id IN (
            SELECT id FROM public.channels WHERE parent_id = (CASE 
                WHEN (auth.jwt()->>'parent_id') IS NOT NULL AND (auth.jwt()->>'parent_id') != ''
                THEN (auth.jwt()->>'parent_id')::uuid 
                ELSE NULL 
            END)
            OR parent_id IN (SELECT parent_id FROM public.children WHERE id = auth.uid())
        )
    );
