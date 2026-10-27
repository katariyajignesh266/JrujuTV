// supabase/functions/sync-channel/index.ts
// Full-catalog resumable sync: pages through all playlistItems using nextPageToken.
// Each invocation processes up to PAGES_PER_INVOCATION pages (5 pages = ~10 quota units),
// then persists the nextPageToken so the next invocation resumes from where it left off.
// This avoids Edge Function execution-time limits while ensuring complete ingestion.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Maximum pages to process per invocation (5 pages × 50 items = 250 videos max per call).
 *  Each page costs 2 quota units (1 playlistItems + 1 videos.list batch).
 *  5 pages = 10 quota units/invocation — safe within the 60-second wall-clock limit.
 *  A 2,700-video channel needs ~54 pages ≈ 11 invocations ≈ 108 quota units total.
 */
const PAGES_PER_INVOCATION = 5;

/** Parse ISO 8601 duration (e.g. PT1H2M10S) into total seconds */
function parseIsoDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || '0', 10) * 3600 +
    parseInt(match[2] || '0', 10) * 60 +
    parseInt(match[3] || '0', 10)
  );
}

/** Pick best available thumbnail URL */
function bestThumbnail(thumbnails: any, videoId: string): string {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
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
    const { channelId, isIncrementalRefresh = false } = body;

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

    // 2. INCREMENTAL RE-SYNC MODE:
    //    If the channel is already fully synced AND the caller is doing a manual refresh,
    //    only fetch the latest 50 uploads (most-recent page, no pageToken = newest first).
    //    This avoids re-walking the entire catalog on every "Sync Videos" click.
    if (isIncrementalRefresh && channel.sync_status === 'complete') {
      const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
        channel.uploads_playlist_id
      )}&maxResults=50&key=${youtubeApiKey}`;

      const plRes = await fetch(plUrl);
      const plData = await plRes.json();
      if (plData.error) {
        return new Response(JSON.stringify({ error: plData.error.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const items = plData.items || [];
      let syncedCount = 0;

      if (items.length > 0) {
        const videoIds = items.map((it: any) => it.contentDetails?.videoId).filter(Boolean);
        const vDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
          ','
        )}&key=${youtubeApiKey}`;
        const vRes = await fetch(vDetailUrl);
        const vData = await vRes.json();
        const videoMap = new Map<string, any>();
        (vData.items || []).forEach((item: any) => videoMap.set(item.id, item));

        const upsertRows = items
          .map((item: any) => {
            const vidId = item.contentDetails?.videoId;
            if (!vidId) return null;
            const detail = videoMap.get(vidId);
            const snippet = item.snippet || {};
            return {
              channel_id: channelId,
              youtube_video_id: vidId,
              title: snippet.title || 'Untitled Video',
              thumbnail_url: bestThumbnail(snippet.thumbnails, vidId),
              duration_seconds: parseIsoDuration(detail?.contentDetails?.duration || ''),
              view_count: parseInt(detail?.statistics?.viewCount || '0', 10),
              published_at: snippet.publishedAt || item.contentDetails?.videoPublishedAt || null,
              last_synced_at: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        if (upsertRows.length > 0) {
          await adminClient
            .from('videos')
            .upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });
          syncedCount = upsertRows.length;
        }
      }

      await adminClient
        .from('channels')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', channelId);

      return new Response(
        JSON.stringify({
          success: true,
          complete: true,
          mode: 'incremental',
          videosSyncedThisInvocation: syncedCount,
          syncedVideoCount: channel.synced_video_count,
          totalVideoCount: channel.total_video_count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. FULL / RESUMABLE SYNC MODE:
    //    Fetch up to PAGES_PER_INVOCATION pages of the uploads playlist.
    //    Resume from channel.sync_page_token if it exists (non-null = mid-sync continuation).

    // Mark as in_progress immediately
    await adminClient
      .from('channels')
      .update({ sync_status: 'in_progress' })
      .eq('id', channelId);

    // On the very first page of this channel, fetch total_video_count from YouTube
    let totalVideoCount = channel.total_video_count || 0;
    if (!channel.sync_page_token && (!channel.total_video_count || channel.total_video_count === 0)) {
      try {
        const channelApiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(
          channel.youtube_channel_id
        )}&key=${youtubeApiKey}`;
        const chRes = await fetch(channelApiUrl);
        const chData = await chRes.json();
        const stats = chData.items?.[0]?.statistics;
        if (stats?.videoCount) {
          totalVideoCount = parseInt(stats.videoCount, 10);
          await adminClient
            .from('channels')
            .update({ total_video_count: totalVideoCount })
            .eq('id', channelId);
        }
      } catch (err) {
        console.warn('Could not fetch channel statistics:', err);
      }
    }

    let currentPageToken: string | null = channel.sync_page_token || null;
    let pagesProcessed = 0;
    let videosThisInvocation = 0;
    let runningTotal = channel.synced_video_count || 0;
    let reachedEnd = false;

    while (pagesProcessed < PAGES_PER_INVOCATION) {
      // Build playlistItems URL (first page has no pageToken; subsequent pages use the token)
      let plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
        channel.uploads_playlist_id
      )}&maxResults=50&key=${youtubeApiKey}`;
      if (currentPageToken) {
        plUrl += `&pageToken=${encodeURIComponent(currentPageToken)}`;
      }

      const plRes = await fetch(plUrl);
      const plData = await plRes.json();

      if (plData.error) {
        // Persist progress so far before returning error
        await adminClient
          .from('channels')
          .update({
            sync_page_token: currentPageToken,
            synced_video_count: runningTotal,
            sync_status: 'in_progress',
          })
          .eq('id', channelId);

        return new Response(JSON.stringify({ error: plData.error.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const items = plData.items || [];

      if (items.length > 0) {
        // Batch fetch duration + stats for all video IDs on this page
        const videoIds: string[] = items
          .map((it: any) => it.contentDetails?.videoId)
          .filter(Boolean);

        const vDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
          ','
        )}&key=${youtubeApiKey}`;
        const vRes = await fetch(vDetailUrl);
        const vData = await vRes.json();
        const videoMap = new Map<string, any>();
        (vData.items || []).forEach((item: any) => videoMap.set(item.id, item));

        // Prepare upsert rows (all videos, not just ≥5min; filtering is done at query time)
        const upsertRows = items
          .map((item: any) => {
            const vidId = item.contentDetails?.videoId;
            if (!vidId) return null;
            const detail = videoMap.get(vidId);
            const snippet = item.snippet || {};
            return {
              channel_id: channelId,
              youtube_video_id: vidId,
              title: snippet.title || 'Untitled Video',
              thumbnail_url: bestThumbnail(snippet.thumbnails, vidId),
              duration_seconds: parseIsoDuration(detail?.contentDetails?.duration || ''),
              view_count: parseInt(detail?.statistics?.viewCount || '0', 10),
              published_at: snippet.publishedAt || item.contentDetails?.videoPublishedAt || null,
              last_synced_at: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        if (upsertRows.length > 0) {
          const { error: upsertError } = await adminClient
            .from('videos')
            .upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });
          if (upsertError) {
            console.error('Upsert error on page', pagesProcessed + 1, ':', upsertError.message);
          } else {
            videosThisInvocation += upsertRows.length;
            runningTotal += upsertRows.length;
          }
        }
      }

      pagesProcessed++;

      // Check if YouTube has a next page
      const nextPageToken: string | null = plData.nextPageToken || null;
      currentPageToken = nextPageToken;

      if (!nextPageToken) {
        // We've reached the true end of this channel's upload playlist
        reachedEnd = true;
        break;
      }
    }

    // Persist state after this invocation's page batch
    if (reachedEnd) {
      // Full sync complete!
      await adminClient
        .from('channels')
        .update({
          sync_status: 'complete',
          sync_page_token: null,
          synced_video_count: runningTotal,
          last_synced_at: new Date().toISOString(),
          last_full_sync_at: new Date().toISOString(),
        })
        .eq('id', channelId);
    } else {
      // More pages remain — persist cursor for next invocation
      await adminClient
        .from('channels')
        .update({
          sync_status: 'in_progress',
          sync_page_token: currentPageToken,
          synced_video_count: runningTotal,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', channelId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        complete: reachedEnd,
        mode: 'full',
        pagesProcessed,
        videosSyncedThisInvocation: videosThisInvocation,
        syncedVideoCount: runningTotal,
        totalVideoCount: totalVideoCount || channel.total_video_count || 0,
        hasMore: !reachedEnd,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync channel';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
