// src/app/api/channels/[channelId]/videos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Video } from '@/types/content';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

    const supabase = await createClient();

    // Fetch channel details
    const { data: channel, error: chErr } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (chErr || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    // Fetch channel videos
    const { data: videos, error: vidErr, count } = await supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .eq('channel_id', channelId)
      .order('published_at', { ascending: false })
      .range(start, end);

    if (vidErr) {
      return NextResponse.json({ error: vidErr.message }, { status: 500 });
    }

    const enhancedVideos: Video[] = (videos || []).map((v) => ({
      ...v,
      channel: {
        id: channel.id,
        title: channel.title,
        thumbnail_url: channel.thumbnail_url,
        subscriber_count: channel.subscriber_count,
      },
      channelName: channel.title,
      channelAvatarUrl: channel.thumbnail_url,
      duration: v.duration_seconds
        ? `${Math.floor(v.duration_seconds / 60)}:${String(v.duration_seconds % 60).padStart(2, '0')}`
        : undefined,
    }));

    const total = count || 0;
    const hasMore = end + 1 < total;

    return NextResponse.json({
      channel,
      videos: enhancedVideos,
      total,
      page,
      hasMore,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch channel videos' }, { status: 500 });
  }
}
