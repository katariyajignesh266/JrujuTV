// src/features/shorts/api/shortsApi.ts
import { createClient } from '@/lib/supabase/client';
import { ShortVideo, ShortComment, FeedResponse } from '../types';

export async function fetchShortsFeed(
  seed: number,
  cursor: number = 0,
  limit: number = 10
): Promise<FeedResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_shorts_feed', {
    p_seed: seed,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) {
    console.error('Failed to fetch shorts feed from RPC:', error);
    throw new Error(error.message);
  }

  return {
    videos: (data?.videos as ShortVideo[]) || [],
    has_more: !!data?.has_more,
    next_cursor: data?.next_cursor ?? null,
    total: data?.total ?? 0,
  };
}

export async function toggleShortLike(videoId: string): Promise<{ liked: boolean; like_count: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('toggle_short_like', {
    p_video_id: videoId,
  });

  if (error) {
    console.error('Failed to toggle short like:', error);
    throw new Error(error.message);
  }

  return data as { liked: boolean; like_count: number };
}

export async function toggleShortSave(videoId: string): Promise<{ saved: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('toggle_short_save', {
    p_video_id: videoId,
  });

  if (error) {
    console.error('Failed to toggle short save:', error);
    throw new Error(error.message);
  }

  return data as { saved: boolean };
}

export async function fetchShortComments(videoId: string): Promise<ShortComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('list_short_comments', {
    p_video_id: videoId,
  });

  if (error) {
    console.error('Failed to fetch short comments:', error);
    throw new Error(error.message);
  }

  return (data as ShortComment[]) || [];
}

export async function addShortComment(
  videoId: string,
  body: string,
  authorName?: string
): Promise<ShortComment> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('add_short_comment', {
    p_video_id: videoId,
    p_body: body,
    p_author_name: authorName || '',
  });

  if (error) {
    console.error('Failed to add short comment:', error);
    throw new Error(error.message);
  }

  return data as ShortComment;
}

export async function deleteShortComment(commentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_short_comment', {
    p_comment_id: commentId,
  });

  if (error) {
    console.error('Failed to delete short comment:', error);
    throw new Error(error.message);
  }
}

export async function recordShortProgress(
  videoId: string,
  watchedSeconds: number,
  progressPercent: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('record_short_progress', {
    p_video_id: videoId,
    p_watched_seconds: Math.round(watchedSeconds),
    p_progress_percent: Math.round(progressPercent),
  });

  if (error) {
    console.warn('Failed to record short progress:', error.message);
  }
}

export async function resetShortsHistory(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('reset_shorts_history');
  if (error) {
    console.error('Failed to reset shorts history:', error);
    throw new Error(error.message);
  }
}

export async function updateChannelShortsSettings(
  channelId: string,
  shortsEnabled: boolean,
  shortsLimit: number | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('update_channel_shorts_settings', {
    p_channel_id: channelId,
    p_shorts_enabled: shortsEnabled,
    p_shorts_limit: shortsLimit,
  });

  if (error) {
    console.error('Failed to update channel shorts settings:', error);
    throw new Error(error.message);
  }
}

