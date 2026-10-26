// src/app/api/videos/[videoId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { interleaveChannelVideos } from '@/lib/feedAlgorithm';
import { Video } from '@/types/content';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const supabase = await createClient();

    // Check if videoId is UUID or youtube_video_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);

    let query = supabase.from('videos').select('*');
    if (isUuid) {
      query = query.eq('id', videoId);
    } else {
      query = query.eq('youtube_video_id', videoId);
    }

    const { data: video, error: vidErr } = await query.maybeSingle();

    if (vidErr || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Fetch channel
    const { data: channel } = await supabase
      .from('channels')
      .select('*')
      .eq('id', video.channel_id)
      .single();

    const enhancedVideo: Video = {
      ...video,
      channel: channel
        ? {
            id: channel.id,
            title: channel.title,
            thumbnail_url: channel.thumbnail_url,
            subscriber_count: channel.subscriber_count,
          }
        : undefined,
      channelName: channel?.title,
      channelAvatarUrl: channel?.thumbnail_url,
      duration: video.duration_seconds
        ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, '0')}`
        : undefined,
    };

    // 1. More from this channel (up to 6 videos)
    const { data: rawMore } = await supabase
      .from('videos')
      .select('*')
      .eq('channel_id', video.channel_id)
      .neq('id', video.id)
      .eq('is_short', false)
      .order('published_at', { ascending: false })
      .limit(6);

    const moreFromChannel: Video[] = (rawMore || []).map((v) => ({
      ...v,
      channel: channel
        ? {
            id: channel.id,
            title: channel.title,
            thumbnail_url: channel.thumbnail_url,
          }
        : undefined,
      channelName: channel?.title,
      channelAvatarUrl: channel?.thumbnail_url,
      duration: v.duration_seconds
        ? `${Math.floor(v.duration_seconds / 60)}:${String(v.duration_seconds % 60).padStart(2, '0')}`
        : undefined,
    }));

    // 2. Up next recommendations from all channels (interleaved)
    const { data: allActiveChannels } = await supabase
      .from('channels')
      .select('id, title, thumbnail_url')
      .eq('is_active', true);

    const channelMap = new Map((allActiveChannels || []).map((c) => [c.id, c]));
    const channelIds = (allActiveChannels || []).map((c) => c.id);

    const { data: recVideos } = await supabase
      .from('videos')
      .select('*')
      .in('channel_id', channelIds)
      .neq('id', video.id)
      .eq('is_short', false)
      .order('published_at', { ascending: false })
      .limit(60);

    const channelVideosMap = new Map<string, Video[]>();
    for (const v of recVideos || []) {
      const ch = channelMap.get(v.channel_id);
      const ev: Video = {
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
        duration: v.duration_seconds
          ? `${Math.floor(v.duration_seconds / 60)}:${String(v.duration_seconds % 60).padStart(2, '0')}`
          : undefined,
      };
      if (!channelVideosMap.has(v.channel_id)) channelVideosMap.set(v.channel_id, []);
      channelVideosMap.get(v.channel_id)!.push(ev);
    }

    const recResult = interleaveChannelVideos(channelVideosMap, 12345, 1, 10);

    return NextResponse.json({
      video: enhancedVideo,
      channel,
      moreFromChannel,
      upNext: recResult.videos,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch video details' }, { status: 500 });
  }
}
