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

    // 2. Fetch total_video_count from YouTube channel statistics (best-effort)
    let totalVideoCount = video_count || 0;
    if (youtubeApiKey && youtube_channel_id) {
      try {
        const chStatsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(
          youtube_channel_id
        )}&key=${youtubeApiKey}`;
        const chRes = await fetch(chStatsUrl);
        const chData = await chRes.json();
        const ytCount = chData.items?.[0]?.statistics?.videoCount;
        if (ytCount) totalVideoCount = parseInt(ytCount, 10);
      } catch (statsErr) {
        console.warn('Could not fetch channel statistics:', statsErr);
      }
    }

    // 3. Insert channel with sync_status='pending' — NO inline video sync.
    //    All video ingestion is handled by the resumable sync-channel function,
    //    triggered by client-side continuation polling after this response returns.
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
        sync_status: 'pending',
        synced_video_count: 0,
        total_video_count: totalVideoCount,
        sync_page_token: null,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return immediately — client will begin continuation polling
    return new Response(
      JSON.stringify({
        success: true,
        channel: newChannel,
        videosSynced: 0,
        syncStatus: 'pending',
        totalVideoCount,
        message: 'Channel added. Video import will begin automatically.',
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
