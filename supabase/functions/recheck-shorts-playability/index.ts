// supabase/functions/recheck-shorts-playability/index.ts
// Background batch re-check job for shorts playability
// Validates video status with YouTube Data API v3 and marks dead/unplayable items
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey || !youtubeApiKey) {
      return new Response(JSON.stringify({ error: 'Missing environment configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch up to 50 shorts that haven't been checked recently or are unknown
    const { data: videos, error: fetchErr } = await adminClient
      .from('videos')
      .select('id, youtube_video_id, duration_seconds')
      .eq('is_short', true)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(50);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!videos || videos.length === 0) {
      return new Response(JSON.stringify({ message: 'No shorts to recheck', checked: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const videoIds = videos.map((v) => v.youtube_video_id).filter(Boolean);
    const vDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${videoIds.join(
      ','
    )}&key=${youtubeApiKey}`;

    const vRes = await fetch(vDetailUrl);
    const vData = await vRes.json();
    const foundMap = new Map<string, any>();
    (vData.items || []).forEach((item: any) => foundMap.set(item.id, item));

    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    for (const v of videos) {
      const item = foundMap.get(v.youtube_video_id);

      if (!item) {
        // Video was deleted or made private on YouTube
        await adminClient
          .from('videos')
          .update({
            playback_status: 'unplayable',
            is_embeddable: false,
            media_status: 'skipped',
            media_error: 'Video deleted or removed from YouTube',
            last_checked_at: nowIso,
          })
          .eq('id', v.id);
        updatedCount++;
      } else {
        const isEmbeddable = item.status?.embeddable !== false;
        const isPublic = item.status?.privacyStatus === 'public';
        const isPlayable = isEmbeddable && isPublic && (v.duration_seconds || 0) > 0;

        await adminClient
          .from('videos')
          .update({
            is_embeddable: isEmbeddable,
            playback_status: isPlayable ? 'playable' : 'unplayable',
            last_checked_at: nowIso,
          })
          .eq('id', v.id);
        updatedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalEvaluated: videos.length,
        updatedCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

