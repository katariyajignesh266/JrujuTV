// src/lib/feedAlgorithm.ts
import { Video } from '@/types/content';

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
 * Hash a string to a 32-bit integer
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
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

/**
 * Interleave videos from multiple channels using a seeded round-robin shuffle.
 * Guarantees:
 * 1. Consecutive videos are never from the same channel if >= 2 channels have available videos.
 * 2. Deterministic across page requests with the same seed.
 * 3. Supports global pagination across page boundaries.
 */
export function interleaveChannelVideos(
  channelVideosMap: Map<string, Video[]>,
  seed: number,
  page: number = 1,
  pageSize: number = 20
): { videos: Video[]; hasMore: boolean; total: number } {
  const channelIds = Array.from(channelVideosMap.keys()).filter((cid) => {
    const vids = channelVideosMap.get(cid);
    return vids && vids.length > 0;
  });

  if (channelIds.length === 0) {
    return { videos: [], hasMore: false, total: 0 };
  }

  // 1. If only 1 channel, sort its videos or shuffle with seed
  if (channelIds.length === 1) {
    const singleChannelVideos = channelVideosMap.get(channelIds[0]) || [];
    const prng = mulberry32(seed);
    const shuffled = seededShuffle(singleChannelVideos, prng);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = shuffled.slice(start, end);
    return {
      videos: paged,
      hasMore: end < shuffled.length,
      total: shuffled.length,
    };
  }

  // 2. Multiple channels:
  // Shuffle channel rotation order using the session seed
  const channelPrng = mulberry32(seed);
  const shuffledChannels = seededShuffle(channelIds, channelPrng);

  // Shuffle each channel's video pool using seed XOR channelIdHash
  const pools = new Map<string, Video[]>();
  let totalVideoCount = 0;

  for (const cid of shuffledChannels) {
    const vids = channelVideosMap.get(cid) || [];
    totalVideoCount += vids.length;
    const cSeed = (seed ^ hashString(cid)) >>> 0;
    const vPrng = mulberry32(cSeed);
    pools.set(cid, seededShuffle(vids, vPrng));
  }

  // 3. Global round-robin interleaving
  const interleavedGlobal: Video[] = [];
  const channelIndices = new Map<string, number>();
  shuffledChannels.forEach((cid) => channelIndices.set(cid, 0));

  let activeChannelList = [...shuffledChannels];
  let lastAddedChannelId: string | null = null;

  while (activeChannelList.length > 0) {
    const nextActiveChannelList: string[] = [];

    for (const cid of activeChannelList) {
      const pool = pools.get(cid) || [];
      const currentIndex = channelIndices.get(cid) || 0;

      if (currentIndex < pool.length) {
        // If consecutive duplicate prevention needed when looping around:
        if (cid === lastAddedChannelId && activeChannelList.length > 1) {
          // Temporarily defer this channel to avoid consecutive match at cycle boundary
          nextActiveChannelList.push(cid);
          continue;
        }

        interleavedGlobal.push(pool[currentIndex]);
        lastAddedChannelId = cid;
        channelIndices.set(cid, currentIndex + 1);

        if (currentIndex + 1 < pool.length) {
          nextActiveChannelList.push(cid);
        }
      }
    }

    // Safety fallback if only deferred channels remain
    if (nextActiveChannelList.length === 1 && nextActiveChannelList[0] === lastAddedChannelId) {
      const cid = nextActiveChannelList[0];
      const pool = pools.get(cid) || [];
      let currentIndex = channelIndices.get(cid) || 0;
      while (currentIndex < pool.length) {
        interleavedGlobal.push(pool[currentIndex]);
        currentIndex++;
      }
      break;
    }

    activeChannelList = nextActiveChannelList;
  }

  // 4. Paginate over the interleaved global list
  const start = Math.max(0, (page - 1) * pageSize);
  const end = start + pageSize;
  const pagedVideos = interleavedGlobal.slice(start, end);

  return {
    videos: pagedVideos,
    hasMore: end < interleavedGlobal.length,
    total: interleavedGlobal.length,
  };
}
