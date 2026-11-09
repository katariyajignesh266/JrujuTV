// src/features/shorts/hooks/useShortsFeedQuery.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ShortVideo } from '../types';
import { fetchShortsFeed, resetShortsHistory } from '../api/shortsApi';
import { useShortsFeatureStore } from '../store/shortsStore';

const PAGE_SIZE = 15;

function isValidYouTubeId(id: string | null | undefined): boolean {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  // Valid YouTube video ID: standard 11 alphanumeric, underscore, or dash
  return /^[a-zA-Z0-9_-]{11}$/.test(trimmed);
}

function sanitizeAndDedupe(
  incoming: ShortVideo[],
  existing: ShortVideo[] = [],
  blacklist: Set<string> = new Set()
): ShortVideo[] {
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
    if (!isValidYouTubeId(ytId)) {
      if (typeof window !== 'undefined' && (window as any).__SHORTS_DEBUG__) {
        console.warn('[sanitizeAndDedupe] Skipped invalid YouTube video ID:', v.youtube_video_id);
      }
      continue;
    }
    // Check blacklist from watchdog reports
    if (blacklist.has(v.id) || blacklist.has(ytId)) continue;

    if (seenYtIds.has(ytId) || (v.id && seenIds.has(v.id))) continue;

    // Filter out rows that are explicitly marked error or duration 0
    if (v.media_status === 'error' || v.duration_seconds === 0) continue;

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

  const { activeIndex, unplayableVideoIds } = useShortsFeatureStore();
  const isFetchingRef = useRef(false);
  const unplayableIdsRef = useRef<Set<string>>(unplayableVideoIds);
  unplayableIdsRef.current = unplayableVideoIds;

  // Initial load
  const loadInitialFeed = useCallback(async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      cursorRef.current = 0;
      const res = await fetchShortsFeed(seedRef.current, 0, PAGE_SIZE);
      const cleaned = sanitizeAndDedupe(res.videos || [], [], unplayableIdsRef.current);
      setVideos(cleaned);
      setHasMore(res.has_more);
      cursorRef.current = res.next_cursor ?? cleaned.length;
      setTotalEligible(res.total);
    } catch (err) {
      console.error('Error loading initial shorts feed:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (initialized) {
      loadInitialFeed();
    }
  }, [loadInitialFeed, initialized]);

  // Load next page: cursor pagination with automatic seed-increment cycle restart
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || loadingMore) return;
    try {
      isFetchingRef.current = true;
      setLoadingMore(true);

      const currentCursor = cursorRef.current;
      const currentSeed = seedRef.current;

      const res = await fetchShortsFeed(currentSeed, currentCursor, PAGE_SIZE);
      let incoming = res.videos || [];

      // If this cycle reached the end, restart with a new seed for an endless feed
      if ((!res.has_more || incoming.length === 0) && cycleCountRef.current < 25) {
        cycleCountRef.current += 1;
        seedRef.current = currentSeed + 1;
        cursorRef.current = 0;

        const loopRes = await fetchShortsFeed(seedRef.current, 0, PAGE_SIZE);
        incoming = loopRes.videos || [];
        cursorRef.current = loopRes.next_cursor ?? incoming.length;
      } else {
        cursorRef.current = res.next_cursor ?? (currentCursor + incoming.length);
      }

      setVideos((prev) => {
        const appended = sanitizeAndDedupe(incoming, prev, unplayableIdsRef.current);
        return [...prev, ...appended];
      });

      setTotalEligible(res.total || 0);
    } catch (err) {
      console.error('Error loading more shorts:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [loadingMore]);

  // Lookahead prefetch: trigger when 5 items remain before reaching the end
  useEffect(() => {
    if (
      videos.length > 0 &&
      activeIndex >= videos.length - 5 &&
      !loadingMore &&
      !isFetchingRef.current
    ) {
      loadMore();
    }
  }, [activeIndex, videos.length, loadingMore, loadMore]);

  // Replay action: resets watch history in DB and restarts from cycle 0
  const handleReplayShorts = useCallback(async () => {
    try {
      setLoading(true);
      await resetShortsHistory();
      cycleCountRef.current = 0;
      seedRef.current = Math.floor(Math.random() * 1000000);
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
