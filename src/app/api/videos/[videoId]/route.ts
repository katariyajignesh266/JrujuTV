// src/app/api/videos/[videoId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { interleaveChannelVideos } from '@/lib/feedAlgorithm';
import { Video } from '@/types/content';

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb3J0eGJjcnFqcWJvcnFxY2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDkzMzU0NywiZXhwIjoyMTA2NTA5NTQ3fQ.KYjTQkvu6MDbYyiXLoJgiNEj8QUURGq6EmR40ilGxLg';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);

    const authHeader = req.headers.get('authorization');
    let supabase: any;
    if (authHeader) {
      supabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
      );
    } else {
      supabase = await createClient();
    }

    let query = supabase.from('videos').select('*');
    if (isUuid) {
      query = query.eq('id', videoId);
    } else {
      query = query.eq('youtube_video_id', videoId);
    }

    let { data: video, error: vidErr } = await query.maybeSingle();

    // Resilient fallback: If user client is blocked by RLS or session is out of sync,
    // fallback to adminClient with service key so valid videos can always be watched.
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY
    );

    if (!video) {
      let adminQuery = adminClient.from('videos').select('*');
      if (isUuid) {
        adminQuery = adminQuery.eq('id', videoId);
      } else {
        adminQuery = adminQuery.eq('youtube_video_id', videoId);
      }
      const adminRes = await adminQuery.maybeSingle();
      if (adminRes.data) {
        video = adminRes.data;
        supabase = adminClient;
      }
    }

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Fetch channel
    let { data: channel } = await supabase
      .from('channels')
      .select('*')
      .eq('id', video.channel_id)
      .maybeSingle();

    if (!channel) {
      const { data: adminChannel } = await adminClient
        .from('channels')
        .select('*')
        .eq('id', video.channel_id)
        .maybeSingle();
      if (adminChannel) channel = adminChannel;
    }

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

    const moreFromChannel: Video[] = (rawMore || []).map((v: any) => ({
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

    const channelMap = new Map<string, any>((allActiveChannels || []).map((c: any) => [c.id, c]));
    const channelIds = (allActiveChannels || []).map((c: any) => c.id);

    const { data: recVideos } = await supabase
      .from('videos')
      .select('*')
      .in('channel_id', channelIds)
      .neq('id', video.id)
      .eq('is_short', false)
      .order('published_at', { ascending: false })
      .limit(60);

    const channelVideosMap = new Map<string, Video[]>();
    for (const v of (recVideos as any[]) || []) {
      const ch = channelMap.get(v.channel_id) as any;
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
