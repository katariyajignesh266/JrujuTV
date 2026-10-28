// src/app/api/channels/[channelId]/videos/route.ts
// Pure keyset cursor pagination (no offset fallback).
// Also returns channel.sync_status, synced_video_count, total_video_count for UI messaging.
// Excludes videos the logged-in child has already watched ≥90%.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Video } from '@/types/content';
import { formatDuration } from '@/lib/formatters';

/**
 * Fetch video IDs the child has watched ≥90% of.
 * Returns an empty array for unauthenticated sessions or non-child roles.
 */
async function fetchCompletedVideoIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const role = user.user_metadata?.role ?? (user as any).role;
    if (role !== 'child') return [];

    const { data, error } = await supabase.rpc('get_child_completed_video_ids', {
      p_child_id: user.id,
    });

    if (error || !data) return [];
    return (data as string[]) ?? [];
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const { searchParams } = new URL(req.url);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const cursorPub = searchParams.get('cursor_published_at');
    const cursorId = searchParams.get('cursor_id');

    const supabase = await createClient();

    // Kick off completed-video fetch and channel fetch in parallel
    const [completedVideoIds, { data: channel, error: chErr }] = await Promise.all([
      fetchCompletedVideoIds(supabase),
      supabase.from('channels').select('*').eq('id', channelId).single(),
    ]);

    if (chErr || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // 2. Pure keyset cursor pagination — always consistent, no offset/cursor mode-switch.
    //    First page: no cursor provided → fetch newest pageSize+1 items.
    //    Subsequent pages: cursor provided → fetch items strictly older than cursor.
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .eq('channel_id', channelId)
      .gte('duration_seconds', 300) // ≥5 minutes only
      .eq('is_short', false)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1); // fetch 1 extra to determine hasMore cleanly

    // Exclude videos the child has already watched ≥90%
    if (completedVideoIds.length > 0) {
      query = query.not('id', 'in', `(${completedVideoIds.join(',')})`);
    }

    if (cursorPub && cursorId) {
      // Keyset condition: items strictly older than the last-seen item
      query = query.or(
        `published_at.lt.${cursorPub},and(published_at.eq.${cursorPub},id.lt.${cursorId})`
      );
    }
    // No else-branch needed: without cursor, the query above returns the newest items

    const { data: rawVideos, error: vidErr, count } = await query;

    if (vidErr) {
      return NextResponse.json({ error: vidErr.message }, { status: 500 });
    }

    const videosList = rawVideos || [];
    const hasMore = videosList.length > pageSize;
    const pageVideos = hasMore ? videosList.slice(0, pageSize) : videosList;

    const lastVideo = pageVideos.length > 0 ? pageVideos[pageVideos.length - 1] : null;
    const nextCursor = lastVideo
      ? { published_at: lastVideo.published_at, id: lastVideo.id }
      : null;

    const enhancedVideos: Video[] = pageVideos.map((v) => ({
      ...v,
      channel: {
        id: channel.id,
        title: channel.title,
        thumbnail_url: channel.thumbnail_url,
        subscriber_count: channel.subscriber_count,
      },
      channelName: channel.title,
      channelAvatarUrl: channel.thumbnail_url,
      duration: formatDuration(v.duration_seconds),
    }));

    return NextResponse.json({
      channel: {
        ...channel,
        // Expose sync tracking fields explicitly for UI messaging
        sync_status: channel.sync_status ?? 'complete',
        synced_video_count: channel.synced_video_count ?? 0,
        total_video_count: channel.total_video_count ?? channel.video_count ?? 0,
      },
      videos: enhancedVideos,
      total: count || 0,
      hasMore,
      nextCursor,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch channel videos' },
      { status: 500 }
    );
  }
}

