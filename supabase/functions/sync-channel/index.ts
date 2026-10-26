import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse ISO 8601 duration (e.g., PT1H2M10S or PT45S) into seconds
function parseIsoDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';

    if (!youtubeApiKey) {
      return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { channelId } = body;

    if (!channelId) {
      return new Response(JSON.stringify({ error: 'channelId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch channel from DB
    const { data: channel, error: channelError } = await adminClient
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return new Response(JSON.stringify({ error: 'Channel not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch upload playlist items (capped at 50 to preserve quota)
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
      channel.uploads_playlist_id
    )}&maxResults=50&key=${youtubeApiKey}`;

    const plRes = await fetch(playlistUrl);
    const plData = await plRes.json();

    if (plData.error) {
      return new Response(JSON.stringify({ error: plData.error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items = plData.items || [];
    if (items.length === 0) {
      await adminClient
        .from('channels')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', channelId);

      return new Response(JSON.stringify({ success: true, videosSynced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Batch fetch duration and statistics via videos.list
    const videoIds: string[] = items
      .map((it: any) => it.contentDetails?.videoId)
      .filter(Boolean);

    const videoDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
      ','
    )}&key=${youtubeApiKey}`;

    const vRes = await fetch(videoDetailUrl);
    const vData = await vRes.json();
    const videoMap = new Map<string, any>();
    if (vData.items) {
      vData.items.forEach((item: any) => {
        videoMap.set(item.id, item);
      });
    }

    // 4. Prepare videos for upsert
    const upsertRows = [];
    for (const item of items) {
      const vidId = item.contentDetails?.videoId;
      if (!vidId) continue;

      const detail = videoMap.get(vidId);
      const snippet = item.snippet || {};
      const durationStr = detail?.contentDetails?.duration || '';
      const durationSeconds = parseIsoDuration(durationStr);
      const views = parseInt(detail?.statistics?.viewCount || '0', 10);

      const title = snippet.title || 'Untitled Video';
      // Pick best thumbnail
      const thumb =
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.standard?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

      const publishedAt = snippet.publishedAt || item.contentDetails?.videoPublishedAt || null;

      upsertRows.push({
        channel_id: channelId,
        youtube_video_id: vidId,
        title,
        thumbnail_url: thumb,
        duration_seconds: durationSeconds,
        view_count: views,
        published_at: publishedAt,
        last_synced_at: new Date().toISOString(),
      });
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await adminClient
        .from('videos')
        .upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });

      if (upsertError) {
        throw upsertError;
      }
    }

    // 5. Update channel last_synced_at and counts
    await adminClient
      .from('channels')
      .update({
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    return new Response(
      JSON.stringify({
        success: true,
        videosSynced: upsertRows.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync channel';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
