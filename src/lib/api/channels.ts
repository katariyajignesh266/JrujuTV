// src/lib/api/channels.ts
import { createClient } from '@/lib/supabase/client';
import { Channel, ChannelPreview, Video } from '@/types/content';

export async function fetchChannelDetails(url: string): Promise<ChannelPreview> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('You must be logged in as a parent to manage channels.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Try direct Edge function first
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/fetch-channel-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    if (res.ok) {
      return data as ChannelPreview;
    }
    // If edge function returned specific error message
    if (data?.error && !data.error.includes('fetch') && !data.error.includes('Failed to send')) {
      throw new Error(data.error);
    }
  } catch (err: any) {
    // If not a network/unavailable error, rethrow
    if (err.message && !err.message.includes('fetch') && !err.message.includes('network')) {
      throw err;
    }
  }

  // Fallback to internal Next.js API route if Edge Function is offline or local
  const localRes = await fetch('/api/channels/fetch-details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });

  const localData = await localRes.json();
  if (!localRes.ok) {
    throw new Error(localData.error || 'Failed to fetch YouTube channel details');
  }

  return localData as ChannelPreview;
}

export async function addChannel(preview: ChannelPreview): Promise<Channel> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('You must be logged in as a parent to add channels.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Try Edge function first
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/add-channel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(preview),
    });

    const data = await res.json();
    if (res.ok && data.channel) {
      return data.channel;
    }
    if (data?.error) {
      throw new Error(data.error);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch') && !err.message.includes('network')) {
      throw err;
    }
  }

  // Fallback to internal Next.js API route
  const localRes = await fetch('/api/channels/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(preview),
  });

  const localData = await localRes.json();
  if (!localRes.ok) {
    throw new Error(localData.error || 'Failed to add channel');
  }

  return localData.channel;
}

export async function syncChannel(
  channelId: string,
  isIncrementalRefresh: boolean = false
): Promise<{
  success: boolean;
  complete: boolean;
  mode?: string;
  videosSyncedThisInvocation?: number;
  syncedVideoCount?: number;
  totalVideoCount?: number;
  hasMore?: boolean;
}> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const body = JSON.stringify({ channelId, isIncrementalRefresh });

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync-channel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    const data = await res.json();
    if (res.ok) {
      return data;
    }
    if (data?.error) {
      throw new Error(data.error);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch') && !err.message.includes('network')) {
      throw err;
    }
  }

  // Fallback to internal route
  const localRes = await fetch('/api/channels/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const localData = await localRes.json();
  if (!localRes.ok) {
    throw new Error(localData.error || 'Failed to sync channel');
  }

  return localData;
}

export async function getChannels(): Promise<Channel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((ch: any) => ({
    ...ch,
    name: ch.title,
    avatarUrl: ch.thumbnail_url,
  }));
}

export async function toggleChannelActive(channelId: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('channels')
    .update({ is_active: isActive })
    .eq('id', channelId);

  if (error) throw error;
}

export async function deleteChannel(channelId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('channels')
    .delete()
    .eq('id', channelId);

  if (error) throw error;
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
    const { error: directErr } = await supabase
      .from('channels')
      .update({
        shorts_enabled: shortsEnabled,
        shorts_limit: shortsLimit,
      })
      .eq('id', channelId);
    if (directErr) throw directErr;
  }
}
