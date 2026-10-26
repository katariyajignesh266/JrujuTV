// src/app/api/feed/shorts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { interleaveChannelVideos } from '@/lib/feedAlgorithm';
import { Video } from '@/types/content';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const seedParam = searchParams.get('seed');
    const seed = seedParam ? parseInt(seedParam, 10) : Math.floor(Math.random() * 1000000);

    const supabase = await createClient();

    // 1. Fetch active channels
    const { data: channels, error: chErr } = await supabase
      .from('channels')
      .select('id, title, thumbnail_url')
      .eq('is_active', true);

    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    if (!channels || channels.length === 0) {
      return NextResponse.json({ videos: [], hasMore: false, total: 0, seed, page });
    }

    // 2. Fetch shorts (is_short = true)
    const channelIds = channels.map((c) => c.id);
    const { data: rawVideos, error: vidErr } = await supabase
      .from('videos')
      .select('*')
      .in('channel_id', channelIds)
      .eq('is_short', true)
      .order('published_at', { ascending: false });

    if (vidErr) {
      return NextResponse.json({ error: vidErr.message }, { status: 500 });
    }

    // 3. Group by channel_id
    const channelMap = new Map(channels.map((c) => [c.id, c]));
    const channelVideosMap = new Map<string, Video[]>();

    for (const v of rawVideos || []) {
      const ch = channelMap.get(v.channel_id);
      const enhancedVideo: Video = {
        ...v,
        channel: ch
          ? {
              id: ch.id,
              title: ch.title,
              thumbnail_url: ch.thumbnail_url,
            }
          : undefined,
        channelName: ch?.title,
        channelAvatarUrl: ch?.thumbnail_url,
      };

      if (!channelVideosMap.has(v.channel_id)) {
        channelVideosMap.set(v.channel_id, []);
      }
      channelVideosMap.get(v.channel_id)!.push(enhancedVideo);
    }

    // 4. Run seeded round-robin shuffle interleaving
    const result = interleaveChannelVideos(channelVideosMap, seed, page, pageSize);

    return NextResponse.json({
      videos: result.videos,
      hasMore: result.hasMore,
      total: result.total,
      seed,
      page,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch shorts feed' }, { status: 500 });
  }
}
