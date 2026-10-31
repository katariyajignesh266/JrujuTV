// src/features/shorts/hooks/useShortsFeedQuery.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ShortVideo } from '../types';
import { fetchShortsFeed, resetShortsHistory } from '../api/shortsApi';
import { useShortsFeatureStore } from '../store/shortsStore';

const PAGE_SIZE = 20;

function isValidYouTubeId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

function sanitizeAndDedupe(incoming: ShortVideo[], existing: ShortVideo[] = []): ShortVideo[] {
  const seenIds = new Set<string>();
  const seenYtIds = new Set<string>();

  existing.forEach((v) => {
    if (v.id) seenIds.add(v.id);
    if (v.youtube_video_id) seenYtIds.add(v.youtube_video_id);
  });

  const validNew: ShortVideo[] = [];
  for (const v of incoming) {
    if (!v) continue;
    const ytId = v.youtube_video_id?.trim();
    if (!isValidYouTubeId(ytId)) continue;
    if (seenYtIds.has(ytId) || (v.id && seenIds.has(v.id))) continue;

    seenIds.add(v.id);
    seenYtIds.add(ytId);
    validNew.push({ ...v, youtube_video_id: ytId });
  }

  return validNew;
}

export function useShortsFeedQuery(initialized: boolean) {
  const seedRef = useRef<number>(Math.floor(Math.random() * 1000000));
  const cursorRef = useRef<number>(0);
  const cycleCountRef = useRef<number>(0);

  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalEligible, setTotalEligible] = useState(0);

  const { initEngagement, activeIndex } = useShortsFeatureStore();
  const isFetchingRef = useRef(false);

  // Initial load
  const loadInitialFeed = useCallback(async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      cursorRef.current = 0;
      const res = await fetchShortsFeed(seedRef.current, 0, PAGE_SIZE);
      const cleaned = sanitizeAndDedupe(res.videos || []);
      setVideos(cleaned);
      setHasMore(true);
      cursorRef.current = res.next_cursor ?? cleaned.length;
      setTotalEligible(res.total);
      initEngagement(cleaned);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[ShortsFeed] Initialized with ${cleaned.length} shorts (total: ${res.total})`);
      }
    } catch (err) {
      console.error('Error loading initial shorts feed:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [initEngagement]);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed, initialized]);

  // Load next page (infinite cursor pagination with seamless reshuffle looping)
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || loadingMore) return;
    try {
      isFetchingRef.current = true;
      setLoadingMore(true);

      let currentCursor = cursorRef.current;
      let currentSeed = seedRef.current;

      const res = await fetchShortsFeed(currentSeed, currentCursor, PAGE_SIZE);
      let incoming = res.videos || [];

      // If this seed reached the end of the database catalog, start a fresh shuffle cycle
      if ((!res.has_more || incoming.length === 0) && cycleCountRef.current < 20) {
        cycleCountRef.current += 1;
        seedRef.current = currentSeed + 1;
        cursorRef.current = 0;

        if (process.env.NODE_ENV === 'development') {
          console.log(`[ShortsFeed] Library cycle completed. Reshuffling for continuous feed (cycle ${cycleCountRef.current})`);
        }

        const loopRes = await fetchShortsFeed(seedRef.current, 0, PAGE_SIZE);
        incoming = loopRes.videos || [];
        cursorRef.current = loopRes.next_cursor ?? incoming.length;
      } else {
        cursorRef.current = res.next_cursor ?? (currentCursor + incoming.length);
      }

      setVideos((prev) => {
        const appended = sanitizeAndDedupe(incoming, prev);
        const nextList = [...prev, ...appended];
        initEngagement(nextList);
        return nextList;
      });

      setTotalEligible(res.total || 0);
    } catch (err) {
      console.error('Error loading more shorts:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [loadingMore, initEngagement]);

  // Lookahead prefetch: trigger when within 4 items from the end
  useEffect(() => {
    if (videos.length > 0 && activeIndex >= videos.length - 4 && !loadingMore && !isFetchingRef.current) {
      loadMore();
    }
  }, [activeIndex, videos.length, loadingMore, loadMore]);

  // Parent action: Reset seen history & replay
  const handleReplayShorts = useCallback(async () => {
    try {
      setLoading(true);
      await resetShortsHistory();
      await loadInitialFeed();
    } catch (err) {
      console.error('Failed to replay shorts:', err);
      setLoading(false);
    }
  }, [loadInitialFeed]);

  return {
    videos,
    loading,
    loadingMore,
    hasMore,
    totalEligible,
    loadMore,
    replayShorts: handleReplayShorts,
    refetch: loadInitialFeed,
  };
}
