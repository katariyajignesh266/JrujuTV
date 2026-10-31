// src/types/content.ts

export interface Channel {
  id: string;
  parent_id: string;
  youtube_channel_id: string;
  title: string;
  thumbnail_url: string;
  subscriber_count: number;
  video_count: number;
  uploads_playlist_id: string;
  is_active: boolean;
  created_at: string;
  last_synced_at: string | null;
  // Resumable sync tracking (added in migration 006)
  sync_status?: 'pending' | 'in_progress' | 'complete';
  sync_page_token?: string | null;
  synced_video_count?: number;
  total_video_count?: number;
  last_full_sync_at?: string | null;
  // Shorts settings & counts (added in migration 014)
  shorts_enabled?: boolean;
  shorts_limit?: number | null;
  shorts_total_count?: number;
  // UI aliases
  name?: string;
  avatarUrl?: string;
}

export interface Video {
  id: string;
  channel_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  is_short: boolean;
  published_at: string | null;
  last_synced_at: string;
  // Joined channel data
  channel?: {
    id: string;
    title: string;
    thumbnail_url: string;
    subscriber_count?: number;
  };
  // Backwards compatibility UI helpers
  channelName?: string;
  channelAvatarUrl?: string;
  duration?: string;
  sourceUrl?: string;
}

export interface ChannelPreview {
  youtube_channel_id: string;
  title: string;
  thumbnail_url: string;
  subscriber_count: number;
  video_count: number;
  uploads_playlist_id: string;
  already_added?: boolean;
}

export interface FeedResponse {
  videos: Video[];
  page: number;
  hasMore: boolean;
  seed: number;
}

export interface WatchSession {
  id: string;
  video_id: string;
  channel_id: string;
  watched_seconds: number;
  video_duration_seconds: number;
  progress_percent: number;
  absolute_position: number;
  last_watched_at: string;
  video_title?: string;
  video_thumbnail?: string;
  channel_name?: string;
}

export interface ChannelWatchStat {
  channel_id: string;
  channel_name: string;
  channel_thumbnail?: string;
  total_seconds: number;
}

export interface ChildWatchSummary {
  lifetime_seconds: number;
  today_seconds: number;
  top_channels: ChannelWatchStat[];
  total_channel_count: number;
}

export interface ChildTodayWatchItem {
  child_id: string;
  seconds: number;
}

