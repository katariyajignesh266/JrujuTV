// src/app/api/feed/shorts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { interleaveChannelVideos } from '@/lib/feedAlgorithm';
import { Video } from '@/types/content';

/**
 * Fetch video IDs the child has watched ≥90% of.
 * Returns an empty array for unauthenticated sessions or non-child roles.
 */
async function fetchCompletedVideoIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const role = user.user_metadata?.role ?? (user as any).role;
    if (role !== 'child') return [];

    const { data, error } = await supabase.rpc('get_child_completed_video_ids', {
      p_child_id: user.id,
    });

    if (error || !data) return [];
    return (data as string[]) ?? [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const seedParam = searchParams.get('seed');
    const seed = seedParam ? parseInt(seedParam, 10) : Math.floor(Math.random() * 1000000);
    // Legacy excludeIds from query param (client-side dedup, kept for backwards compat)
    const excludeIdsParam = searchParams.get('excludeIds') || '';
    const clientExcludeSet = new Set(
      excludeIdsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const supabase = await createClient();

    // Fetch server-side completed video IDs (progress ≥ 90%) in parallel with channel fetch
    const completedVideoIdsPromise = fetchCompletedVideoIds(supabase);

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

    // Await completed IDs (was kicked off in parallel)
    const completedVideoIds = await completedVideoIdsPromise;
    // Merge server-side completed IDs with client-side excludeIds for a unified exclude set
    const excludeSet = new Set<string>([...clientExcludeSet, ...completedVideoIds]);

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

    // 3. Separate unwatched vs watched shorts
    //    - "completed" (≥90%): NEVER shown (hard exclude)
    //    - "seen but <90%" (in clientExcludeSet only): recycled after unwatched exhausted
    let candidateVideos = rawVideos || [];

    // Hard-exclude server-side completed videos
    if (completedVideoIds.length > 0) {
      const completedSet = new Set<string>(completedVideoIds);
      candidateVideos = candidateVideos.filter(
        (v) => !completedSet.has(v.id) && !completedSet.has(v.youtube_video_id)
      );
    }

    // Apply legacy client-side exclude (session-dedup, not permanent)
    if (clientExcludeSet.size > 0 && candidateVideos.length > 0) {
      const unwatched = candidateVideos.filter(
        (v) => !clientExcludeSet.has(v.id) && !clientExcludeSet.has(v.youtube_video_id)
      );
      const watched = candidateVideos.filter(
        (v) => clientExcludeSet.has(v.id) || clientExcludeSet.has(v.youtube_video_id)
      );

      // If we have enough unwatched shorts, prioritize them exclusively
      if (unwatched.length >= 15) {
        candidateVideos = unwatched;
      } else {
        // If unwatched are few, put unwatched first, followed by recycled watched shorts
        candidateVideos = [...unwatched, ...watched];
      }
    }

    // 4. Group by channel_id
    const channelMap = new Map(channels.map((c) => [c.id, c]));
    const channelVideosMap = new Map<string, Video[]>();

    for (const v of candidateVideos) {
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

    // 5. Run seeded round-robin shuffle interleaving
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

