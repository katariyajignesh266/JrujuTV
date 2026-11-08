// src/features/shorts/hooks/useShortsV2PlayerPool.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShortsFeatureStore } from '../store/shortsStore';
import { recordShortProgress } from '../api/shortsApi';
import { ShortVideo } from '../types';

export type V2ReadinessState =
  | 'IDLE'
  | 'LOADING'
  | 'HAVE_METADATA'
  | 'LOADING_DATA'
  | 'CAN_PLAY'
  | 'PLAYING'
  | 'WAITING'
  | 'ERROR'
  | 'PAUSED';

export interface V2PoolItemState {
  index: number;
  videoId: string;
  storageUrl: string;
  status: V2ReadinessState;
  readyState: number;
  networkState: number;
  isReady: boolean;
  isPlaying: boolean;
  firstFrameRendered: boolean;
  firstFrameLatencyMs: number | null;
  timeToMetadataMs: number | null;
  timeToCanplayMs: number | null;
  timeToFirstFrameMs: number | null;
  cdnDownloadTimingMs: number | null;
  bufferingEvents: number;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  preloadStartTime: number | null;
  lastPlayTime: number | null;
  isAttached: boolean;
  retryCount: number;
}

export interface V2SlotTelemetry {
  index: number;
  videoId: string;
  status: V2ReadinessState;
  readyState: number;
  networkState: number;
  isAttached: boolean;
  isReady: boolean;
  isPlaying: boolean;
  firstFrameRendered: boolean;
  currentTime: number;
  duration: number;
  errorCode: number | null;
  errorMessage: string | null;
}

export interface V2PoolDebugInfo {
  activeSlot: number;
  poolSize: number;
  slots: Record<number, string>; // index -> state name
  slotDetails: Record<number, V2SlotTelemetry>;
  activeDownloads: number;
  lastLatencyMs: number | null;
  timeToCanplayMs: number | null;
  timeToFirstFrameMs: number | null;
  cdnTimingMs: number | null;
  bufferingEvents: number;
  spinnerCount: number;
  lowMemoryMode: boolean;
  preloadWindow: string;
  nextPreloadState: string;
  secondNextPreloadState: string;
  creationCount: number;
  cleanupCount: number;
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
  const [statusMap, setStatusMap] = useState<Record<number, V2ReadinessState>>({});
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [debugInfo, setDebugInfo] = useState<V2PoolDebugInfo>({
    activeSlot: 0,
    poolSize: 0,
    slots: {},
    slotDetails: {},
    activeDownloads: 0,
    lastLatencyMs: null,
    timeToCanplayMs: null,
    timeToFirstFrameMs: null,
    cdnTimingMs: null,
    bufferingEvents: 0,
    spinnerCount: 0,
    lowMemoryMode: false,
    preloadWindow: '[0, 2]',
    nextPreloadState: 'IDLE',
    secondNextPreloadState: 'IDLE',
    creationCount: 0,
    cleanupCount: 0,
  });

  // Pool holding initialized HTMLVideoElement instances: index -> element
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const elementStatesRef = useRef<Map<number, V2PoolItemState>>(new Map());
  const hostContainersRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Pool statistics counters
  const creationCountRef = useRef(0);
  const cleanupCountRef = useRef(0);
  const spinnerCountRef = useRef(0);

  // Latency & performance tracking
  const scrollStartTimesRef = useRef<Map<number, number>>(new Map());
  const loadStartTimesRef = useRef<Map<number, number>>(new Map());

  // Watch progress tracking
  const activeVideoRef = useRef<ShortVideo | null>(null);
  const watchedSecondsRef = useRef(0);
  const maxPercentRef = useRef(0);
  const hasRecorded50PercentRef = useRef(false);

  // Live references for stable callbacks
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
      cleanupCountRef.current += 1;
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
      setStatusMap((prev) => {
        if (!prev[index]) return prev;
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      setErrorMap((prev) => {
        if (!prev[index]) return prev;
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
    }
  }, []);

  // Safely play an element with proper autoplay error handling and audio state
  const safePlayVideo = useCallback((el: HTMLVideoElement, index: number) => {
    if (index !== activeIndexRef.current) {
      // Must not play non-active elements
      try {
        el.pause();
        el.muted = true;
      } catch {
        // ignore
      }
      return;
    }

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
          // 1. Autoplay policy blocked unmuted playback -> fall back to muted autoplay
          if (err.name === 'NotAllowedError') {
            el.muted = true;
            el.play().catch(() => {});
          } else if (err.name === 'AbortError') {
            // 2. AbortError: play() was interrupted by scroll/pause -> ignore normal transition
          } else {
            console.warn(`[ShortsV2Pool] play() failed on index ${index}:`, err);
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
          // If this slot is active, ensure container attachment and start playback
          const host = hostContainersRef.current.get(index);
          if (host && !host.contains(el)) {
            host.replaceChildren(el);
            if (state) state.isAttached = true;
          }

          if (priority === 'active' && el.paused && (state?.isReady || el.readyState >= 2)) {
            safePlayVideo(el, index);
          }
          return el;
        }

        // Different video assigned to this index -> teardown old element
        teardownElement(index);
      }

      creationCountRef.current += 1;
      el = document.createElement('video');
      el.playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.loop = true;
      el.className =
        'shorts-native-video absolute inset-0 w-full h-full object-cover pointer-events-none select-none';

      videoElementsRef.current.set(index, el);

      el.setAttribute('data-src', video.storage_url);
      el.src = video.storage_url;
      // Preload auto downloads progressive bytes for instant playback
      el.preload = 'auto';
      el.muted = true;

      state = {
        index,
        videoId: video.id,
        storageUrl: video.storage_url,
        status: 'LOADING',
        readyState: el.readyState,
        networkState: el.networkState,
        isReady: false,
        isPlaying: false,
        firstFrameRendered: false,
        firstFrameLatencyMs: null,
        timeToMetadataMs: null,
        timeToCanplayMs: null,
        timeToFirstFrameMs: null,
        cdnDownloadTimingMs: null,
        bufferingEvents: 0,
        currentTime: 0,
        duration: video.duration_seconds || 0,
        paused: true,
        ended: false,
        errorCode: null,
        errorMessage: null,
        preloadStartTime: performance.now(),
        lastPlayTime: null,
        isAttached: false,
        retryCount: 0,
      };
      elementStatesRef.current.set(index, state);
      setStatusMap((prev) => ({ ...prev, [index]: 'LOADING' }));

      loadStartTimesRef.current.set(index, performance.now());

      // ── Event Handlers ────────────────────────────────────────────────────────

      const handleLoadStart = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr) {
          curr.status = 'LOADING';
          curr.networkState = el?.networkState ?? 0;
          setStatusMap((prev) => ({ ...prev, [index]: 'LOADING' }));
        }
      };

      const handleLoadedMetadata = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr && el) {
          curr.status = 'HAVE_METADATA';
          curr.readyState = el.readyState;
          curr.duration = el.duration || curr.duration;
          const startTime = loadStartTimesRef.current.get(index);
          if (startTime && curr.timeToMetadataMs === null) {
            curr.timeToMetadataMs = Math.round(performance.now() - startTime);
          }
          setStatusMap((prev) => ({ ...prev, [index]: 'HAVE_METADATA' }));
        }
      };

      const handleLoadedData = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr && el) {
          curr.status = 'LOADING_DATA';
          curr.readyState = el.readyState;
          setStatusMap((prev) => ({ ...prev, [index]: 'LOADING_DATA' }));
        }
      };

      const handleCanPlay = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr && el) {
          curr.isReady = true;
          curr.readyState = el.readyState;
          curr.status = 'CAN_PLAY';
          const startTime = loadStartTimesRef.current.get(index);
          if (startTime && curr.timeToCanplayMs === null) {
            curr.timeToCanplayMs = Math.round(performance.now() - startTime);
          }

          // Measure CDN resource download duration via Resource Timing API
          try {
            if (typeof performance !== 'undefined' && performance.getEntriesByName) {
              const entries = performance.getEntriesByName(video.storage_url!);
              if (entries.length > 0) {
                const resEntry = entries[entries.length - 1] as PerformanceResourceTiming;
                curr.cdnDownloadTimingMs = Math.round(resEntry.duration);
              }
            }
          } catch {
            // ignore
          }
        }

        setReadyMap((prev) => ({ ...prev, [index]: true }));
        setStatusMap((prev) => ({ ...prev, [index]: 'CAN_PLAY' }));

        // If this slot is the currently active short, start playing immediately!
        if (index === activeIndexRef.current && el?.paused) {
          safePlayVideo(el, index);
        }
      };

      const handlePlaying = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr && el) {
          curr.isPlaying = true;
          curr.paused = false;
          curr.status = 'PLAYING';
          curr.lastPlayTime = performance.now();
        }
        setPlayingMap((prev) => ({ ...prev, [index]: true }));
        setStatusMap((prev) => ({ ...prev, [index]: 'PLAYING' }));

        // Detect first frame painted via requestVideoFrameCallback
        if ('requestVideoFrameCallback' in el!) {
          (el as any).requestVideoFrameCallback(() => {
            if (curr) {
              curr.firstFrameRendered = true;
              const scrollStart = scrollStartTimesRef.current.get(index);
              if (scrollStart && curr.firstFrameLatencyMs === null) {
                curr.firstFrameLatencyMs = Math.round(performance.now() - scrollStart);
                curr.timeToFirstFrameMs = curr.firstFrameLatencyMs;
              }
            }
            setFirstFrameMap((prev) => ({ ...prev, [index]: true }));
          });
        } else {
          // Fallback for browsers without requestVideoFrameCallback
          if (curr) {
            curr.firstFrameRendered = true;
            const scrollStart = scrollStartTimesRef.current.get(index);
            if (scrollStart && curr.firstFrameLatencyMs === null) {
              curr.firstFrameLatencyMs = Math.round(performance.now() - scrollStart);
              curr.timeToFirstFrameMs = curr.firstFrameLatencyMs;
            }
          }
          setFirstFrameMap((prev) => ({ ...prev, [index]: true }));
        }
      };

      const handleWaiting = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr && curr.status === 'PLAYING') {
          curr.bufferingEvents += 1;
          curr.status = 'WAITING';
          spinnerCountRef.current += 1;
          setStatusMap((prev) => ({ ...prev, [index]: 'WAITING' }));
        }
      };

      const handlePause = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr) {
          curr.isPlaying = false;
          curr.paused = true;
          if (curr.status === 'PLAYING') {
            curr.status = 'PAUSED';
            setStatusMap((prev) => ({ ...prev, [index]: 'PAUSED' }));
          }
        }
      };

      const handleError = () => {
        const curr = elementStatesRef.current.get(index);
        const mediaError = el?.error;
        const code = mediaError?.code ?? null;
        const message = mediaError?.message || `MediaError (code ${code})`;

        if (curr) {
          curr.status = 'ERROR';
          curr.errorCode = code;
          curr.errorMessage = message;
        }

        setErrorMap((prev) => ({ ...prev, [index]: message }));
        setStatusMap((prev) => ({ ...prev, [index]: 'ERROR' }));

        console.warn(`[ShortsV2Pool] Media error on index ${index} (${video.title}): code=${code} ${message}`);

        // Safe retry once for transient network failures
        if (curr && curr.retryCount < 2 && code === 2 /* NETWORK_ERR */) {
          curr.retryCount += 1;
          console.log(`[ShortsV2Pool] Retrying index ${index} (attempt ${curr.retryCount})...`);
          setTimeout(() => {
            if (videoElementsRef.current.has(index)) {
              el?.load();
            }
          }, 500);
          return;
        }

        // Notify parent of fallback / skip
        onSkipErrorRef.current?.(index);
      };

      const handleTimeUpdate = () => {
        const curr = elementStatesRef.current.get(index);
        if (curr && el) {
          curr.currentTime = el.currentTime;
          curr.duration = el.duration || curr.duration;
        }
      };

      el.addEventListener('loadstart', handleLoadStart);
      el.addEventListener('loadedmetadata', handleLoadedMetadata);
      el.addEventListener('loadeddata', handleLoadedData);
      el.addEventListener('canplay', handleCanPlay);
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('waiting', handleWaiting);
      el.addEventListener('pause', handlePause);
      el.addEventListener('error', handleError);
      el.addEventListener('timeupdate', handleTimeUpdate);

      // Attach immediately to host container if container exists
      const host = hostContainersRef.current.get(index);
      if (host && !host.contains(el)) {
        host.replaceChildren(el);
        state.isAttached = true;
      }

      // Check if already ready (e.g. from fast cache)
      if (el.readyState >= 2) {
        handleCanPlay();
      } else {
        el.load();
      }

      return el;
    },
    [safePlayVideo, teardownElement]
  );

  // Attach host container for an index (STABLE CALLBACK)
  // Handles React mounting, unmounting, Strict Mode, and scrolling
  const attachV2Container = useCallback(
    (index: number, containerEl: HTMLDivElement | null) => {
      if (!containerEl) {
        // Container unmounted: clean host reference
        hostContainersRef.current.delete(index);
        const state = elementStatesRef.current.get(index);
        if (state) state.isAttached = false;
        return;
      }

      hostContainersRef.current.set(index, containerEl);
      const state = elementStatesRef.current.get(index);
      if (state) state.isAttached = true;

      const video = videosRef.current[index];
      if (!video?.storage_url) return;

      const priority = index === activeIndexRef.current ? 'active' : 'preload';
      const el = prepareVideoElement(index, video, priority);
      if (el && !containerEl.contains(el)) {
        containerEl.replaceChildren(el);
        if (state) state.isAttached = true;
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

    // 1. Immediately pause and mute all non-active elements
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

    // 2. Prepare / Play current active index [N] (Top Priority)
    const currentVideo = videos[activeIndex];
    if (currentVideo?.storage_url) {
      const activeEl = prepareVideoElement(activeIndex, currentVideo, 'active');
      const activeHost = hostContainersRef.current.get(activeIndex);
      if (activeEl && activeHost && !activeHost.contains(activeEl)) {
        activeHost.replaceChildren(activeEl);
      }

      if (activeEl) {
        const state = elementStatesRef.current.get(activeIndex);
        if (state?.isReady || activeEl.readyState >= 2) {
          safePlayVideo(activeEl, activeIndex);
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
          preHost.replaceChildren(preEl);
        }
      }
    }

    // 4. Bounded Memory Management: Prune elements strictly outside [N-1, N+preloadAhead]
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

    // 5. Update debug diagnostic telemetry
    const slotsDebug: Record<number, string> = {};
    const slotDetails: Record<number, V2SlotTelemetry> = {};
    let activeDownloads = 0;

    videoElementsRef.current.forEach((el, idx) => {
      const state = elementStatesRef.current.get(idx);
      const isAct = idx === activeIndex;
      slotsDebug[idx] = isAct ? 'PLAYING' : state?.status || (state?.isReady ? 'READY' : 'LOADING');

      if (el.networkState === 2 /* NETWORK_LOADING */) {
        activeDownloads += 1;
      }

      slotDetails[idx] = {
        index: idx,
        videoId: state?.videoId || '',
        status: state?.status || 'IDLE',
        readyState: el.readyState,
        networkState: el.networkState,
        isAttached: !!state?.isAttached,
        isReady: !!state?.isReady,
        isPlaying: !!state?.isPlaying,
        firstFrameRendered: !!state?.firstFrameRendered,
        currentTime: Math.round(el.currentTime * 10) / 10,
        duration: Math.round(el.duration || 0),
        errorCode: state?.errorCode ?? null,
        errorMessage: state?.errorMessage ?? null,
      };
    });

    const activeState = elementStatesRef.current.get(activeIndex);
    const nextState = elementStatesRef.current.get(activeIndex + 1);
    const secondNextState = elementStatesRef.current.get(activeIndex + 2);

    setDebugInfo({
      activeSlot: activeIndex,
      poolSize: videoElementsRef.current.size,
      slots: slotsDebug,
      slotDetails,
      activeDownloads,
      lastLatencyMs: activeState?.firstFrameLatencyMs ?? null,
      timeToCanplayMs: activeState?.timeToCanplayMs ?? null,
      timeToFirstFrameMs: activeState?.firstFrameLatencyMs ?? null,
      cdnTimingMs: activeState?.cdnDownloadTimingMs ?? null,
      bufferingEvents: activeState?.bufferingEvents ?? 0,
      spinnerCount: spinnerCountRef.current,
      lowMemoryMode: isLowMem,
      preloadWindow: `[${Math.max(0, activeIndex - 1)}, ${activeIndex + preloadAhead}]`,
      nextPreloadState: nextState?.status ?? (nextState?.isReady ? 'READY' : 'IDLE'),
      secondNextPreloadState: isLowMem
        ? 'SKIPPED (low-mem)'
        : secondNextState?.status ?? (secondNextState?.isReady ? 'READY' : 'IDLE'),
      creationCount: creationCountRef.current,
      cleanupCount: cleanupCountRef.current,
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

  // Explicit retry action for UI error card
  const retryVideo = useCallback(
    (index: number) => {
      const video = videosRef.current[index];
      if (!video) return;

      setErrorMap((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });

      teardownElement(index);
      const isAct = index === activeIndexRef.current;
      const el = prepareVideoElement(index, video, isAct ? 'active' : 'preload');
      const host = hostContainersRef.current.get(index);
      if (el && host) {
        host.replaceChildren(el);
      }
    },
    [prepareVideoElement, teardownElement]
  );

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

  // Teardown everything on complete unmount
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
    statusMap,
    errorMap,
    progressMap,
    handleUserGesturePlayback,
    retryVideo,
    debugInfo,
  };
}
