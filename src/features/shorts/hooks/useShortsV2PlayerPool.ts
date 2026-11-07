// src/features/shorts/hooks/useShortsV2PlayerPool.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShortsFeatureStore } from '../store/shortsStore';
import { recordShortProgress } from '../api/shortsApi';
import { ShortVideo } from '../types';

export type V2PlaybackStatus = 'IDLE' | 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED';

export interface V2PoolItemState {
  index: number;
  videoId: string;
  storageUrl: string;
  status: V2PlaybackStatus;
  isReady: boolean;
  isPlaying: boolean;
  firstFrameRendered: boolean;
  firstFrameLatencyMs: number | null;
  timeToCanplayMs: number | null;
  cdnDownloadTimingMs: number | null;
  bufferingEvents: number;
}

export interface V2PoolDebugInfo {
  activeSlot: number;
  poolSize: number;
  slots: Record<number, string>; // index -> state name
  lastLatencyMs: number | null;
  timeToCanplayMs: number | null;
  timeToFirstFrameMs: number | null;
  cdnTimingMs: number | null;
  bufferingEvents: number;
  spinnerCount: number;
  lowMemoryMode: boolean;
  nextPreloadState: string;
  secondNextPreloadState: string;
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
    timeToCanplayMs: null,
    timeToFirstFrameMs: null,
    cdnTimingMs: null,
    bufferingEvents: 0,
    spinnerCount: 0,
    lowMemoryMode: false,
    nextPreloadState: 'IDLE',
    secondNextPreloadState: 'IDLE',
  });

  // Pool holding initialized HTMLVideoElement instances: index -> element
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const elementStatesRef = useRef<Map<number, V2PoolItemState>>(new Map());
  const hostContainersRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Latency & performance tracking
  const scrollStartTimesRef = useRef<Map<number, number>>(new Map());
  const loadStartTimesRef = useRef<Map<number, number>>(new Map());
  const spinnerCountRef = useRef(0);

  // Watch progress tracking
  const activeVideoRef = useRef<ShortVideo | null>(null);
  const watchedSecondsRef = useRef(0);
  const maxPercentRef = useRef(0);
  const hasRecorded50PercentRef = useRef(false);

  // Keep live references for stable callbacks
  const videosRef = useRef<ShortVideo[]>(videos);
  videosRef.current = videos;
  const activeIndexRef = useRef<number>(activeIndex);
  activeIndexRef.current = activeIndex;
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;
  const hasUserGestureUnlockedRef = useRef<boolean>(hasUserGestureUnlocked);
  hasUserGestureUnlockedRef.current = hasUserGestureUnlocked;
  const onSkipErrorRef = useRef(onSkipError);
  onSkipErrorRef.current = onSkipError;

  // Low-memory detection (devices < 2GB RAM or 2G / saveData connections)
  const isLowMemoryDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as any;
    if (nav.deviceMemory && nav.deviceMemory < 2) return true;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && (conn.saveData || conn.effectiveType === '2g')) return true;
    return false;
  }, []);

  // Flush watch progress to database
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
      loadStartTimesRef.current.delete(index);
      setReadyMap((prev) => {
        if (!prev[index]) return prev;
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      setPlayingMap((prev) => {
        if (!prev[index]) return prev;
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      setFirstFrameMap((prev) => {
        if (!prev[index]) return prev;
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
    }
  }, []);

  // Safely play an element with proper autoplay error handling
  const safePlayVideo = useCallback((el: HTMLVideoElement) => {
    try {
      if (hasUserGestureUnlockedRef.current && !isMutedRef.current) {
        el.muted = false;
        el.volume = 1.0;
      } else {
        el.muted = true;
      }

      const promise = el.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          // Autoplay policy blocked unmuted playback -> fall back to muted
          if (err.name === 'NotAllowedError') {
            el.muted = true;
            el.play().catch(() => {});
          }
        });
      }
    } catch {
      // ignore
    }
  }, []);

  // Create, prepare & prebuffer a native HTML5 video element
  const prepareVideoElement = useCallback(
    (index: number, video: ShortVideo, priority: 'active' | 'preload' = 'preload') => {
      if (!video?.storage_url) return null;

      let el = videoElementsRef.current.get(index);
      let state = elementStatesRef.current.get(index);

      if (el) {
        // Reuse existing HTMLVideoElement; avoid re-assigning src or calling load() if unchanged
        if (el.getAttribute('data-src') === video.storage_url) {
          if (priority === 'active' && el.paused && (state?.isReady || el.readyState >= 3)) {
            safePlayVideo(el);
          }
          return el;
        }
      } else {
        el = document.createElement('video');
        el.playsInline = true;
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        el.loop = true;
        el.className =
          'shorts-native-video absolute inset-0 w-full h-full object-cover pointer-events-none select-none';

        videoElementsRef.current.set(index, el);
      }

      el.setAttribute('data-src', video.storage_url);
      el.src = video.storage_url;
      el.preload = priority === 'active' || priority === 'preload' ? 'auto' : 'metadata';
      el.muted = true;

      state = {
        index,
        videoId: video.id,
        storageUrl: video.storage_url,
        status: 'LOADING',
        isReady: false,
        isPlaying: false,
        firstFrameRendered: false,
        firstFrameLatencyMs: null,
        timeToCanplayMs: null,
        cdnDownloadTimingMs: null,
        bufferingEvents: 0,
      };
      elementStatesRef.current.set(index, state);

      loadStartTimesRef.current.set(index, performance.now());

      const handleCanPlay = () => {
        const currState = elementStatesRef.current.get(index);
        if (currState) {
          currState.isReady = true;
          currState.status = 'READY';
          const startTime = loadStartTimesRef.current.get(index);
          if (startTime && currState.timeToCanplayMs === null) {
            currState.timeToCanplayMs = Math.round(performance.now() - startTime);
          }

          // Measure CDN resource download duration via Resource Timing API
          try {
            if (typeof performance !== 'undefined' && performance.getEntriesByName) {
              const entries = performance.getEntriesByName(video.storage_url!);
              if (entries.length > 0) {
                const resEntry = entries[entries.length - 1] as PerformanceResourceTiming;
                currState.cdnDownloadTimingMs = Math.round(resEntry.duration);
              }
            }
          } catch {
            // ignore
          }
        }
        setReadyMap((prev) => ({ ...prev, [index]: true }));

        // If this slot is the currently active short, start playing immediately!
        if (index === activeIndexRef.current && el?.paused) {
          safePlayVideo(el);
        }
      };

      const handlePlaying = () => {
        const currState = elementStatesRef.current.get(index);
        if (currState) {
          currState.isPlaying = true;
          currState.status = 'PLAYING';
        }
        setPlayingMap((prev) => ({ ...prev, [index]: true }));

        // Detect first frame painted via requestVideoFrameCallback
        if ('requestVideoFrameCallback' in el!) {
          (el as any).requestVideoFrameCallback(() => {
            if (currState) {
              currState.firstFrameRendered = true;
              const scrollStart = scrollStartTimesRef.current.get(index);
              if (scrollStart && currState.firstFrameLatencyMs === null) {
                currState.firstFrameLatencyMs = Math.round(performance.now() - scrollStart);
              }
            }
            setFirstFrameMap((prev) => ({ ...prev, [index]: true }));
          });
        } else {
          // Fallback for browsers without requestVideoFrameCallback
          if (currState) {
            currState.firstFrameRendered = true;
            const scrollStart = scrollStartTimesRef.current.get(index);
            if (scrollStart && currState.firstFrameLatencyMs === null) {
              currState.firstFrameLatencyMs = Math.round(performance.now() - scrollStart);
            }
          }
          setFirstFrameMap((prev) => ({ ...prev, [index]: true }));
        }
      };

      const handleWaiting = () => {
        const currState = elementStatesRef.current.get(index);
        if (currState && currState.status === 'PLAYING') {
          currState.bufferingEvents += 1;
          spinnerCountRef.current += 1;
        }
      };

      const handlePause = () => {
        const currState = elementStatesRef.current.get(index);
        if (currState && currState.status === 'PLAYING') {
          currState.isPlaying = false;
          currState.status = 'PAUSED';
        }
      };

      const handleError = () => {
        const currState = elementStatesRef.current.get(index);
        if (currState) {
          currState.status = 'IDLE';
        }
        console.warn(`[ShortsV2Pool] Playback error on index ${index}. Falling back...`);
        onSkipErrorRef.current?.(index);
      };

      el.addEventListener('canplay', handleCanPlay, { once: true });
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('waiting', handleWaiting);
      el.addEventListener('pause', handlePause);
      el.addEventListener('error', handleError);

      // Check if already ready (e.g. from cache or fast load)
      if (el.readyState >= 3) {
        handleCanPlay();
      } else {
        // Trigger preloading
        el.load();
      }

      return el;
    },
    [safePlayVideo]
  );

  // Attach host container for an index (STABLE CALLBACK)
  const attachV2Container = useCallback(
    (index: number, containerEl: HTMLDivElement | null) => {
      if (!containerEl) {
        hostContainersRef.current.delete(index);
        return;
      }

      hostContainersRef.current.set(index, containerEl);
      const video = videosRef.current[index];
      if (!video?.storage_url) return;

      const priority = index === activeIndexRef.current ? 'active' : 'preload';
      const el = prepareVideoElement(index, video, priority);
      if (el && !containerEl.contains(el)) {
        containerEl.innerHTML = '';
        containerEl.appendChild(el);
      }
    },
    [prepareVideoElement]
  );

  // Programmatically pause all V2 videos (used for mutual exclusion when V1 is active)
  const pauseAllV2Videos = useCallback(() => {
    videoElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.muted = true;
      } catch {
        // ignore
      }
    });
  }, []);

  // Preload scheduler & lifecycle manager triggered on activeIndex changes
  useEffect(() => {
    const isLowMem = isLowMemoryDevice();
    const preloadAhead = isLowMem ? 1 : 2;

    scrollStartTimesRef.current.set(activeIndex, performance.now());

    // 1. Immediately pause all non-active elements
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

    // 2. Prepare / Play current active index [N]
    const currentVideo = videos[activeIndex];
    if (currentVideo?.storage_url) {
      const activeEl = prepareVideoElement(activeIndex, currentVideo, 'active');
      const activeHost = hostContainersRef.current.get(activeIndex);
      if (activeEl && activeHost && !activeHost.contains(activeEl)) {
        activeHost.innerHTML = '';
        activeHost.appendChild(activeEl);
      }

      if (activeEl) {
        const state = elementStatesRef.current.get(activeIndex);
        if (state?.isReady || activeEl.readyState >= 3) {
          safePlayVideo(activeEl);
        }
      }
    }

    // 3. Priority Pre-buffer upcoming videos [N+1, N+2]
    for (let offset = 1; offset <= preloadAhead; offset++) {
      const targetIdx = activeIndex + offset;
      const nextVid = videos[targetIdx];
      if (nextVid?.storage_url) {
        const preEl = prepareVideoElement(targetIdx, nextVid, 'preload');
        const preHost = hostContainersRef.current.get(targetIdx);
        if (preEl && preHost && !preHost.contains(preEl)) {
          preHost.innerHTML = '';
          preHost.appendChild(preEl);
        }
      }
    }

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

    // 5. Update debug diagnostic statistics
    const slotsDebug: Record<number, string> = {};
    videoElementsRef.current.forEach((_, idx) => {
      const state = elementStatesRef.current.get(idx);
      slotsDebug[idx] =
        idx === activeIndex
          ? 'PLAYING'
          : state?.status || (state?.isReady ? 'READY' : 'LOADING');
    });

    const activeState = elementStatesRef.current.get(activeIndex);
    const nextState = elementStatesRef.current.get(activeIndex + 1);
    const secondNextState = elementStatesRef.current.get(activeIndex + 2);

    setDebugInfo({
      activeSlot: activeIndex,
      poolSize: videoElementsRef.current.size,
      slots: slotsDebug,
      lastLatencyMs: activeState?.firstFrameLatencyMs ?? null,
      timeToCanplayMs: activeState?.timeToCanplayMs ?? null,
      timeToFirstFrameMs: activeState?.firstFrameLatencyMs ?? null,
      cdnTimingMs: activeState?.cdnDownloadTimingMs ?? null,
      bufferingEvents: activeState?.bufferingEvents ?? 0,
      spinnerCount: spinnerCountRef.current,
      lowMemoryMode: isLowMem,
      nextPreloadState: nextState?.status ?? (nextState?.isReady ? 'READY' : 'IDLE'),
      secondNextPreloadState: isLowMem
        ? 'SKIPPED (low-mem)'
        : secondNextState?.status ?? (secondNextState?.isReady ? 'READY' : 'IDLE'),
    });
  }, [
    activeIndex,
    videos,
    isLowMemoryDevice,
    prepareVideoElement,
    safePlayVideo,
    teardownElement,
  ]);

  // Audio mute/unmute synchronization when user gesture or mute changes
  useEffect(() => {
    const activeEl = videoElementsRef.current.get(activeIndex);
    if (!activeEl) return;

    if (hasUserGestureUnlocked && !isMuted) {
      activeEl.muted = false;
      activeEl.volume = 1.0;
    } else {
      activeEl.muted = true;
    }
  }, [activeIndex, isMuted, hasUserGestureUnlocked]);

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
    pauseAllV2Videos,
    readyMap,
    playingMap,
    firstFrameMap,
    progressMap,
    handleUserGesturePlayback,
    debugInfo,
  };
}
