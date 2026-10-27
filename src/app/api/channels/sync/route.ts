// src/app/api/channels/sync/route.ts
// Fallback sync route (mirrors sync-channel Edge Function logic for local development).
// Full resumable paging with nextPageToken persistence + incremental re-sync mode.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const PAGES_PER_INVOCATION = 5;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb3J0eGJjcnFqcWJvcnFxY2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDkzMzU0NywiZXhwIjoyMTA2NTA5NTQ3fQ.KYjTQkvu6MDbYyiXLoJgiNEj8QUURGq6EmR40ilGxLg';

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

function bestThumbnail(thumbnails: any, videoId: string): string {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, isIncrementalRefresh = false } = body;

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    // Use admin client to bypass RLS for updates (needed for synced_video_count etc.)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const adminClient = createAdminClient(supabaseUrl, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify this channel belongs to the authenticated parent
    const { data: channel, error: chErr } = await adminClient
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .eq('parent_id', user.id)
      .single();

    if (chErr || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    // --- INCREMENTAL REFRESH MODE ---
    if (isIncrementalRefresh && channel.sync_status === 'complete') {
      const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
        channel.uploads_playlist_id
      )}&maxResults=50&key=${apiKey}`;

      const plRes = await fetch(plUrl);
      const plData = await plRes.json();
      const items = plData.items || [];
      let syncedCount = 0;

      if (items.length > 0) {
        const videoIds = items.map((it: any) => it.contentDetails?.videoId).filter(Boolean);
        const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
          ','
        )}&key=${apiKey}`;
        const vRes = await fetch(detailUrl);
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
              channel_id: channel.id,
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
          await adminClient.from('videos').upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });
          syncedCount = upsertRows.length;
        }
      }

      await adminClient
        .from('channels')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', channel.id);

      return NextResponse.json({
        success: true,
        complete: true,
        mode: 'incremental',
        videosSynced: syncedCount,
        syncedVideoCount: channel.synced_video_count,
        totalVideoCount: channel.total_video_count,
      });
    }

    // --- FULL / RESUMABLE SYNC MODE ---
    // Mark in_progress
    await adminClient
      .from('channels')
      .update({ sync_status: 'in_progress' })
      .eq('id', channelId);

    // Fetch total_video_count from YouTube on first page (if not already set)
    let totalVideoCount = channel.total_video_count || 0;
    if (!channel.sync_page_token && (!channel.total_video_count || channel.total_video_count === 0)) {
      try {
        const chStatsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(
          channel.youtube_channel_id
        )}&key=${apiKey}`;
        const chRes = await fetch(chStatsUrl);
        const chData = await chRes.json();
        const ytCount = chData.items?.[0]?.statistics?.videoCount;
        if (ytCount) {
          totalVideoCount = parseInt(ytCount, 10);
          await adminClient
            .from('channels')
            .update({ total_video_count: totalVideoCount })
            .eq('id', channelId);
        }
      } catch (e) {
        console.warn('Could not fetch channel statistics:', e);
      }
    }

    let currentPageToken: string | null = channel.sync_page_token || null;
    let pagesProcessed = 0;
    let videosThisInvocation = 0;
    let runningTotal = channel.synced_video_count || 0;
    let reachedEnd = false;

    while (pagesProcessed < PAGES_PER_INVOCATION) {
      let plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
        channel.uploads_playlist_id
      )}&maxResults=50&key=${apiKey}`;
      if (currentPageToken) {
        plUrl += `&pageToken=${encodeURIComponent(currentPageToken)}`;
      }

      const plRes = await fetch(plUrl);
      const plData = await plRes.json();

      if (plData.error) {
        await adminClient
          .from('channels')
          .update({ sync_page_token: currentPageToken, synced_video_count: runningTotal })
          .eq('id', channelId);
        return NextResponse.json({ error: plData.error.message }, { status: 502 });
      }

      const items = plData.items || [];

      if (items.length > 0) {
        const videoIds: string[] = items
          .map((it: any) => it.contentDetails?.videoId)
          .filter(Boolean);

        const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(
          ','
        )}&key=${apiKey}`;
        const vRes = await fetch(detailUrl);
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
              channel_id: channel.id,
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
          const { error: upsertErr } = await adminClient
            .from('videos')
            .upsert(upsertRows, { onConflict: 'channel_id,youtube_video_id' });
          if (!upsertErr) {
            videosThisInvocation += upsertRows.length;
            runningTotal += upsertRows.length;
          }
        }
      }

      pagesProcessed++;
      const nextPageToken: string | null = plData.nextPageToken || null;
      currentPageToken = nextPageToken;

      if (!nextPageToken) {
        reachedEnd = true;
        break;
      }
    }

    // Persist state
    if (reachedEnd) {
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

    return NextResponse.json({
      success: true,
      complete: reachedEnd,
      mode: 'full',
      pagesProcessed,
      videosSyncedThisInvocation: videosThisInvocation,
      syncedVideoCount: runningTotal,
      totalVideoCount: totalVideoCount || channel.total_video_count || 0,
      hasMore: !reachedEnd,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}
