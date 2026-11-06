// src/features/shorts/hooks/useShortsV2PlayerPool.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShortsFeatureStore } from '../store/shortsStore';
import { recordShortProgress } from '../api/shortsApi';
import { ShortVideo } from '../types';

export interface V2PoolItemState {
  index: number;
  videoId: string;
  storageUrl: string;
  isReady: boolean;
  isPlaying: boolean;
  firstFrameRendered: boolean;
  firstFrameLatencyMs: number | null;
}

export interface V2PoolDebugInfo {
  activeSlot: number;
  poolSize: number;
  slots: Record<number, string>; // index -> state name
  lastLatencyMs: number | null;
  spinnerCount: number;
  lowMemoryMode: boolean;
}

export function useShortsV2PlayerPool(
  videos: ShortVideo[],
  onSkipError?: (index: number) => void
) {
  const { isMuted, activeIndex, hasUserGestureUnlocked, setGestureUnlocked } =
    useShortsFeatureStore();

  const [readyMap, setReadyMap] = useState<Record<number, boolean>>({});
  const [playingMap, setPlayingMap] = useState<Record<number, boolean>>({});
  const [firstFrameMap, setFirstFrameMap] = useState<Record<number, boolean>>({});
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [debugInfo, setDebugInfo] = useState<V2PoolDebugInfo>({
    activeSlot: 0,
    poolSize: 0,
    slots: {},
    lastLatencyMs: null,
    spinnerCount: 0,
    lowMemoryMode: false,
  });

  // Pool holding initialized HTMLVideoElement instances: index -> element
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const elementStatesRef = useRef<Map<number, V2PoolItemState>>(new Map());
  const hostContainersRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Latency tracking
  const scrollStartTimesRef = useRef<Map<number, number>>(new Map());
  const spinnerCountRef = useRef(0);

  // Watch progress tracking
  const activeVideoRef = useRef<ShortVideo | null>(null);
  const watchedSecondsRef = useRef(0);
  const maxPercentRef = useRef(0);
  const hasRecorded50PercentRef = useRef(false);

  // Low-memory detection (devices < 2GB RAM or 2G connections)
  const isLowMemoryDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as any;
    if (nav.deviceMemory && nav.deviceMemory < 2) return true;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && (conn.saveData || conn.effectiveType === '2g')) return true;
    return false;
  }, []);

  // Flush watch progress
  const flushProgress = useCallback(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    const watched = watchedSecondsRef.current;
    const maxPct = maxPercentRef.current;

    if (watched > 0 || maxPct > 0) {
      recordShortProgress(video.id, watched, maxPct);
    }

    watchedSecondsRef.current = 0;
    maxPercentRef.current = 0;
  }, []);

  // Sync active video for tracking
  useEffect(() => {
    flushProgress();
    const curr = videos[activeIndex];
    activeVideoRef.current = curr || null;
    hasRecorded50PercentRef.current = false;
  }, [activeIndex, videos, flushProgress]);

  // Teardown a single video element cleanly
  const teardownElement = useCallback((index: number) => {
    const el = videoElementsRef.current.get(index);
    if (el) {
      try {
        el.pause();
        el.removeAttribute('src');
        el.load(); // Abort pending network downloads
        el.remove();
      } catch {
        // ignore
      }
      videoElementsRef.current.delete(index);
      elementStatesRef.current.delete(index);
    }
  }, []);

  // Create & prebuffer a native HTML5 video element
  const prepareVideoElement = useCallback(
    (index: number, video: ShortVideo) => {
      if (!video?.storage_url) return null;
      if (videoElementsRef.current.has(index)) {
        return videoElementsRef.current.get(index)!;
      }

      const el = document.createElement('video');
      el.src = video.storage_url;
      el.preload = 'auto';
      el.muted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.loop = true;
      el.className =
        'shorts-native-video absolute inset-0 w-full h-full object-cover pointer-events-none select-none';

      const state: V2PoolItemState = {
        index,
        videoId: video.id,
        storageUrl: video.storage_url,
        isReady: false,
        isPlaying: false,
        firstFrameRendered: false,
        firstFrameLatencyMs: null,
      };

      elementStatesRef.current.set(index, state);

      const onCanPlay = () => {
        state.isReady = true;
        setReadyMap((prev) => ({ ...prev, [index]: true }));
      };

      const onPlaying = () => {
        state.isPlaying = true;
        setPlayingMap((prev) => ({ ...prev, [index]: true }));

        // Detect first frame painted
        if ('requestVideoFrameCallback' in el) {
          (el as any).requestVideoFrameCallback(() => {
            state.firstFrameRendered = true;
            setFirstFrameMap((prev) => ({ ...prev, [index]: true }));

            const startTime = scrollStartTimesRef.current.get(index);
            if (startTime) {
              const latency = Math.round(performance.now() - startTime);
              state.firstFrameLatencyMs = latency;
            }
          });
        } else {
          // Fallback for browsers without requestVideoFrameCallback
          state.firstFrameRendered = true;
          setFirstFrameMap((prev) => ({ ...prev, [index]: true }));
        }
      };

      const onError = () => {
        console.warn(`[ShortsV2Pool] Playback error on index ${index}. Falling back...`);
        onSkipError?.(index);
      };

      el.addEventListener('canplay', onCanPlay, { once: true });
      el.addEventListener('playing', onPlaying);
      el.addEventListener('error', onError);

      // Trigger preloading
      el.load();

      videoElementsRef.current.set(index, el);
      return el;
    },
    [onSkipError]
  );

  // Attach/Mount host container for an index
  const attachV2Container = useCallback(
    (index: number, containerEl: HTMLDivElement | null) => {
      if (!containerEl) {
        hostContainersRef.current.delete(index);
        return;
      }

      hostContainersRef.current.set(index, containerEl);
      const video = videos[index];
      if (!video?.storage_url) return;

      const el = prepareVideoElement(index, video);
      if (el && !containerEl.contains(el)) {
        containerEl.innerHTML = '';
        containerEl.appendChild(el);
      }
    },
    [videos, prepareVideoElement]
  );

  // Preload scheduler & lifecycle manager on activeIndex change
  useEffect(() => {
    const isLowMem = isLowMemoryDevice();
    const preloadAhead = isLowMem ? 1 : 2;

    scrollStartTimesRef.current.set(activeIndex, performance.now());

    // 1. Prepare / Mount current active index [N]
    const currentVideo = videos[activeIndex];
    if (currentVideo?.storage_url) {
      const activeEl = prepareVideoElement(activeIndex, currentVideo);
      const activeHost = hostContainersRef.current.get(activeIndex);
      if (activeEl && activeHost && !activeHost.contains(activeEl)) {
        activeHost.innerHTML = '';
        activeHost.appendChild(activeEl);
      }

      if (activeEl) {
        if (hasUserGestureUnlocked && !isMuted) {
          activeEl.muted = false;
          activeEl.volume = 1.0;
        } else {
          activeEl.muted = true;
        }

        activeEl.play().catch((err) => {
          // Autoplay policy blocked audio -> fall back to muted
          if (err.name === 'NotAllowedError') {
            activeEl.muted = true;
            activeEl.play().catch(() => {});
          }
        });
      }
    }

    // 2. Pre-buffer upcoming videos [N+1, N+2]
    for (let offset = 1; offset <= preloadAhead; offset++) {
      const targetIdx = activeIndex + offset;
      const nextVid = videos[targetIdx];
      if (nextVid?.storage_url) {
        prepareVideoElement(targetIdx, nextVid);
      }
    }

    // 3. Pause & mute all non-active elements
    videoElementsRef.current.forEach((el, idx) => {
      if (idx !== activeIndex) {
        try {
          el.pause();
          el.currentTime = 0;
          el.muted = true;
        } catch {
          // ignore
        }
      }
    });

    // 4. Memory management: Prune elements outside [N-1, N+preloadAhead]
    const keepRange = new Set<number>();
    keepRange.add(activeIndex - 1);
    keepRange.add(activeIndex);
    for (let offset = 1; offset <= preloadAhead; offset++) {
      keepRange.add(activeIndex + offset);
    }

    const indicesToPrune: number[] = [];
    videoElementsRef.current.forEach((_, idx) => {
      if (!keepRange.has(idx)) {
        indicesToPrune.push(idx);
      }
    });

    indicesToPrune.forEach((idx) => teardownElement(idx));

    // Update debug statistics
    const slotsDebug: Record<number, string> = {};
    videoElementsRef.current.forEach((el, idx) => {
      const state = elementStatesRef.current.get(idx);
      slotsDebug[idx] = idx === activeIndex ? 'PLAYING' : state?.isReady ? 'READY' : 'WARMING';
    });

    const activeState = elementStatesRef.current.get(activeIndex);
    setDebugInfo({
      activeSlot: activeIndex,
      poolSize: videoElementsRef.current.size,
      slots: slotsDebug,
      lastLatencyMs: activeState?.firstFrameLatencyMs ?? null,
      spinnerCount: spinnerCountRef.current,
      lowMemoryMode: isLowMem,
    });
  }, [
    activeIndex,
    videos,
    isMuted,
    hasUserGestureUnlocked,
    isLowMemoryDevice,
    prepareVideoElement,
    teardownElement,
  ]);

  // Handle tap gesture anywhere on the video
  const handleUserGesturePlayback = useCallback(() => {
    const activeEl = videoElementsRef.current.get(activeIndex);
    if (!activeEl) return;

    try {
      if (!hasUserGestureUnlocked) {
        // First tap unlocks audio for the entire session
        setGestureUnlocked(true);
        activeEl.muted = false;
        activeEl.volume = 1.0;
        activeEl.play().catch(() => {});
      } else {
        // Subsequent taps toggle play / pause
        if (activeEl.paused) {
          activeEl.play().catch(() => {});
        } else {
          activeEl.pause();
        }
      }
    } catch {
      // ignore
    }
  }, [activeIndex, hasUserGestureUnlocked, setGestureUnlocked]);

  // Watch progress polling timer
  useEffect(() => {
    const timer = setInterval(() => {
      const activeEl = videoElementsRef.current.get(activeIndex);
      if (!activeEl || activeEl.paused) return;

      const currentTime = activeEl.currentTime || 0;
      const duration = activeEl.duration || activeVideoRef.current?.duration_seconds || 30;

      if (duration > 0) {
        const pct = Math.min(100, Math.round((currentTime / duration) * 100));
        setProgressMap((prev) => ({ ...prev, [activeIndex]: pct }));

        watchedSecondsRef.current += 1;
        maxPercentRef.current = Math.max(maxPercentRef.current, pct);

        if (pct >= 50 && !hasRecorded50PercentRef.current) {
          hasRecorded50PercentRef.current = true;
          const video = activeVideoRef.current;
          if (video) {
            recordShortProgress(video.id, watchedSecondsRef.current, pct);
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIndex]);

  // Teardown everything on unmount
  useEffect(() => {
    const videoElements = videoElementsRef.current;
    const elementStates = elementStatesRef.current;
    const hostContainers = hostContainersRef.current;

    return () => {
      flushProgress();
      videoElements.forEach((el) => {
        try {
          el.pause();
          el.removeAttribute('src');
          el.load();
          el.remove();
        } catch {
          // ignore
        }
      });
      videoElements.clear();
      elementStates.clear();
      hostContainers.clear();
    };
  }, [flushProgress]);

  return {
    attachV2Container,
    readyMap,
    playingMap,
    firstFrameMap,
    progressMap,
    handleUserGesturePlayback,
    debugInfo,
  };
}

