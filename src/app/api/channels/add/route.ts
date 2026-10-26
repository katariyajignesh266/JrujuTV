// src/app/api/channels/add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function parseIsoDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      youtube_channel_id,
      title,
      thumbnail_url,
      subscriber_count = 0,
      video_count = 0,
      uploads_playlist_id,
    } = body;

    if (!youtube_channel_id || !title || !uploads_playlist_id) {
      return NextResponse.json({ error: 'Missing required channel information' }, { status: 400 });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('parent_id', user.id)
      .eq('youtube_channel_id', youtube_channel_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Channel already added' }, { status: 400 });
    }

    // Insert channel
    const { data: channel, error: insertError } = await supabase
      .from('channels')
      .insert({
        parent_id: user.id,
        youtube_channel_id,
        title,
        thumbnail_url,
        subscriber_count,
        video_count,
        uploads_playlist_id,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Initial sync
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    let syncedCount = 0;

    if (apiKey) {
      try {
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
          uploads_playlist_id
        )}&maxResults=50&key=${apiKey}`;

        const plRes = await fetch(playlistUrl);
        const plData = await plRes.json();
        const items = plData.items || [];

        if (items.length > 0) {
          const videoIds = items.map((it: any) => it.contentDetails?.videoId).filter(Boolean);
          const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
            ','
          )}&key=${apiKey}`;

          const vRes = await fetch(detailUrl);
          const vData = await vRes.json();
          const videoMap = new Map<string, any>();
          if (vData.items) {
            vData.items.forEach((item: any) => videoMap.set(item.id, item));
          }

          const upsertRows = items.map((item: any) => {
            const vidId = item.contentDetails?.videoId;
            const detail = videoMap.get(vidId);
            const snippet = item.snippet || {};
            const durationSeconds = parseIsoDuration(detail?.contentDetails?.duration || '');
            const views = parseInt(detail?.statistics?.viewCount || '0', 10);
            const thumb =
              snippet.thumbnails?.maxres?.url ||
              snippet.thumbnails?.standard?.url ||
              snippet.thumbnails?.high?.url ||
              snippet.thumbnails?.medium?.url ||
              `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

            return {
              channel_id: channel.id,
              youtube_video_id: vidId,
              title: snippet.title || 'Untitled Video',
              thumbnail_url: thumb,
              duration_seconds: durationSeconds,
              view_count: views,
              published_at: snippet.publishedAt || item.contentDetails?.videoPublishedAt || null,
              last_synced_at: new Date().toISOString(),
            };
          });

          if (upsertRows.length > 0) {
            await supabase.from('videos').upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });
            syncedCount = upsertRows.length;
          }

          await supabase
            .from('channels')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', channel.id);
        }
      } catch (syncErr) {
        console.error('Initial sync error:', syncErr);
      }
    }

    return NextResponse.json({ success: true, channel, videosSynced: syncedCount }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add channel' }, { status: 500 });
  }
}
