import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse ISO 8601 duration
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(
        JSON.stringify({ error: 'Missing required channel information' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check for duplicates
    const { data: existing } = await adminClient
      .from('channels')
      .select('id')
      .eq('parent_id', user.id)
      .eq('youtube_channel_id', youtube_channel_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Channel already added' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Insert into channels table
    const { data: newChannel, error: insertError } = await adminClient
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
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Perform initial video sync
    let syncedCount = 0;
    if (youtubeApiKey) {
      try {
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
          uploads_playlist_id
        )}&maxResults=50&key=${youtubeApiKey}`;
        const plRes = await fetch(playlistUrl);
        const plData = await plRes.json();
        const items = plData.items || [];

        if (items.length > 0) {
          const videoIds = items.map((it: any) => it.contentDetails?.videoId).filter(Boolean);
          const videoDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
            ','
          )}&key=${youtubeApiKey}`;
          const vRes = await fetch(videoDetailUrl);
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
              channel_id: newChannel.id,
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
            await adminClient
              .from('videos')
              .upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });
            syncedCount = upsertRows.length;
          }

          await adminClient
            .from('channels')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', newChannel.id);
        }
      } catch (syncErr) {
        console.error('Initial sync warning:', syncErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        channel: newChannel,
        videosSynced: syncedCount,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add channel';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
