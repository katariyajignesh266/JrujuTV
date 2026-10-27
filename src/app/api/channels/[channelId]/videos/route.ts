// src/app/api/channels/[channelId]/videos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Video } from '@/types/content';
import { formatDuration } from '@/lib/formatters';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const cursorPub = searchParams.get('cursor_published_at');
    const cursorId = searchParams.get('cursor_id');

    const supabase = await createClient();

    // 1. Fetch channel details
    const { data: channel, error: chErr } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (chErr || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // 2. Fetch channel videos with strict duration >= 300 seconds and is_short = false
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .eq('channel_id', channelId)
      .gte('duration_seconds', 300) // User-specified 5-minute requirement
      .eq('is_short', false)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false });

    // Keyset pagination when cursor is provided, falling back to range
    if (cursorPub && cursorId) {
      query = query
        .or(
          `published_at.lt.${cursorPub},and(published_at.eq.${cursorPub},id.lt.${cursorId})`
        )
        .limit(pageSize + 1);
    } else {
      const start = (page - 1) * pageSize;
      const end = start + pageSize; // fetch 1 extra item to determine hasMore cleanly
      query = query.range(start, end);
    }

    const { data: rawVideos, error: vidErr, count } = await query;

    if (vidErr) {
      return NextResponse.json({ error: vidErr.message }, { status: 500 });
    }

    const videosList = rawVideos || [];
    const hasMore = videosList.length > pageSize;
    const pageVideos = hasMore ? videosList.slice(0, pageSize) : videosList;

    const lastVideo = pageVideos.length > 0 ? pageVideos[pageVideos.length - 1] : null;
    const nextCursor = lastVideo
      ? {
          published_at: lastVideo.published_at,
          id: lastVideo.id,
        }
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
      channel,
      videos: enhancedVideos,
      total: count || 0,
      page,
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
