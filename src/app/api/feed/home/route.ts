// src/app/api/feed/home/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Video } from '@/types/content';
import { formatDuration } from '@/lib/formatters';

interface ChannelCursor {
  published_at: string;
  id: string;
}

type CursorMap = Record<string, ChannelCursor>;

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates array shuffle with seeded RNG
 */
function seededShuffle<T>(array: T[], prng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const seedParam = searchParams.get('seed');
    const seed = seedParam ? parseInt(seedParam, 10) : 42;
    const rawCursor = searchParams.get('cursor');

    let cursors: CursorMap = {};
    if (rawCursor) {
      try {
        const decoded = Buffer.from(rawCursor, 'base64').toString('utf-8');
        cursors = JSON.parse(decoded);
      } catch {
        // Fallback if not base64 encoded
        try {
          cursors = JSON.parse(rawCursor);
        } catch {
          cursors = {};
        }
      }
    }

    const supabase = await createClient();

    // 1. Fetch active channels (RLS automatically scopes to parent or child's parent)
    const { data: channels, error: chErr } = await supabase
      .from('channels')
      .select('id, title, thumbnail_url')
      .eq('is_active', true);

    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    if (!channels || channels.length === 0) {
      return NextResponse.json({
        videos: [],
        hasMore: false,
        total: 0,
        nextCursor: null,
        seed,
        page,
      });
    }

    // Deterministically shuffle channels once according to the session seed
    const prng = mulberry32(seed);
    const sortedChannels = seededShuffle(channels, prng);
    const channelIds = sortedChannels.map((c) => c.id);
    const channelMap = new Map(sortedChannels.map((c) => [c.id, c]));

    // 2. Attempt RPC execution first (database-native keyset interleaving)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'get_interleaved_feed_cursor',
        {
          p_channel_ids: channelIds,
          p_channel_cursors: cursors,
          p_limit: pageSize,
          p_min_duration: 300, // User-specified 5-minute requirement
        }
      );

      if (!rpcErr && rpcData && Array.isArray(rpcData.videos)) {
        const enhancedVideos: Video[] = rpcData.videos.map((v: any) => ({
          ...v,
          duration: formatDuration(v.duration_seconds),
        }));

        const nextCursorEncoded = rpcData.next_cursors
          ? Buffer.from(JSON.stringify(rpcData.next_cursors)).toString('base64')
          : null;

        return NextResponse.json({
          videos: enhancedVideos,
          hasMore: Boolean(rpcData.has_more),
          nextCursor: nextCursorEncoded,
          seed,
          page,
        });
      }
    } catch {
      // Fall through to server-side keyset query if RPC not yet deployed to remote instance
    }

    // 3. High-performance server-side keyset queries per channel (Fall-through / Edge Engine)
    // Keyset pagination avoids fetching all 1,400+ videos. Only requests a small window per channel.
    const perChannelLimit = Math.max(4, Math.ceil(pageSize / channelIds.length) + 2);
    const channelCandidates = new Map<string, any[]>();
    let anyChannelHasMore = false;

    await Promise.all(
      channelIds.map(async (cid) => {
        let query = supabase
          .from('videos')
          .select('*')
          .eq('channel_id', cid)
          .gte('duration_seconds', 300) // Strictly >= 300s
          .eq('is_short', false)
          .order('published_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(perChannelLimit + 1);

        const cur = cursors[cid];
        if (cur && cur.published_at && cur.id) {
          query = query.or(
            `published_at.lt.${cur.published_at},and(published_at.eq.${cur.published_at},id.lt.${cur.id})`
          );
        }

        const { data: vids, error: vidErr } = await query;
        if (!vidErr && vids) {
          if (vids.length > perChannelLimit) {
            anyChannelHasMore = true;
            channelCandidates.set(cid, vids.slice(0, perChannelLimit));
          } else {
            channelCandidates.set(cid, vids);
          }
        } else {
          channelCandidates.set(cid, []);
        }
      })
    );

    // 4. Interleave candidates in round-robin sequence
    const interleavedVideos: Video[] = [];
    const nextCursors: CursorMap = { ...cursors };
    let exhausted = false;
    let round = 0;

    while (interleavedVideos.length < pageSize && !exhausted) {
      let addedInRound = 0;
      for (const cid of channelIds) {
        if (interleavedVideos.length >= pageSize) break;

        const pool = channelCandidates.get(cid) || [];
        if (round < pool.length) {
          const raw = pool[round];
          const ch = channelMap.get(cid);

          const enhanced: Video = {
            ...raw,
            channel: ch
              ? {
                  id: ch.id,
                  title: ch.title,
                  thumbnail_url: ch.thumbnail_url,
                }
              : undefined,
            channelName: ch?.title,
            channelAvatarUrl: ch?.thumbnail_url,
            duration: formatDuration(raw.duration_seconds),
          };

          interleavedVideos.push(enhanced);
          nextCursors[cid] = {
            published_at: raw.published_at,
            id: raw.id,
          };
          addedInRound++;
        }
      }

      if (addedInRound === 0) {
        exhausted = true;
      }
      round++;
    }

    const hasMore =
      anyChannelHasMore ||
      channelIds.some((cid) => {
        const pool = channelCandidates.get(cid) || [];
        return round < pool.length;
      });

    const nextCursorEncoded = Buffer.from(JSON.stringify(nextCursors)).toString('base64');

    return NextResponse.json({
      videos: interleavedVideos,
      hasMore,
      nextCursor: nextCursorEncoded,
      seed,
      page,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch home feed' },
      { status: 500 }
    );
  }
}
