// src/features/shorts/types/index.ts

export type ShortMediaStatus = 'pending' | 'processing' | 'ready' | 'error' | 'skipped';

export type ShortPlaybackState =
  | 'IDLE'
  | 'LOADING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'WAITING'
  | 'ERROR';

export interface ShortDiagnosticLog {
  index: number;
  videoId: string;
  youtubeId: string;
  source: 'V1' | 'V2';
  state: ShortPlaybackState;
  stateTransitions: { state: ShortPlaybackState; timestamp: number }[];
  errorCode: number | string | null;
  errorMessage: string | null;
  timeToFirstFrameMs: number | null;
  poolState: string;
  watchdogTriggered: boolean;
  timestamp: string;
}

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
  storage_url?: string | null;
  poster_url?: string | null;
  media_status?: ShortMediaStatus;
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
