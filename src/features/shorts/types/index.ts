// src/features/shorts/types/index.ts

export interface ShortVideo {
  id: string;
  channel_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  is_short: boolean;
  published_at: string | null;
  channel?: {
    id: string;
    title: string;
    thumbnail_url: string;
  };
  channelName?: string;
  channelAvatarUrl?: string;
}

export interface FeedResponse {
  videos: ShortVideo[];
  has_more: boolean;
  next_cursor: number | null;
  total: number;
}
