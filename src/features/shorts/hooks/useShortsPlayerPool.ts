// src/features/shorts/hooks/useShortsPlayerPool.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShortsFeatureStore } from '../store/shortsStore';
import { recordShortProgress } from '../api/shortsApi';
import { ShortVideo } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// ── Singleton YouTube IFrame API Script Loader ──────────────────────────────────
let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();

  if (!ytApiPromise) {
    ytApiPromise = new Promise<void>((resolve) => {
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        resolve();
      };

      const timer = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  return ytApiPromise;
}

interface PlayerPoolEntry {
  player: any;
  videoId: string;
  containerEl: HTMLDivElement;
  hostDiv: HTMLDivElement;
  isReady: boolean;
  isPrimed: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

export function useShortsPlayerPool(
  videos: ShortVideo[],
  onSkipError?: (index: number) => void
) {
  const { isMuted, activeIndex, hasUserGestureUnlocked, setGestureUnlocked } =
    useShortsFeatureStore();

  const poolRef = useRef<Map<number, PlayerPoolEntry>>(new Map());
  const [playingIndices, setPlayingIndices] = useState<Record<number, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});

  // Heartbeat tracking for watch progress
  const activeVideoRef = useRef<ShortVideo | null>(null);
  const activeDurationRef = useRef<number>(30);
  const watchedSecondsRef = useRef<number>(0);
  const maxPercentRef = useRef<number>(0);
  const hasRecorded50PercentRef = useRef<boolean>(false);

  // Live stable references to prevent unnecessary callback invalidations
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

  // Load YouTube API script once on mount
  useEffect(() => {
    loadYouTubeIframeApi();
  }, []);

  // Flush watched progress when changing active video
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

  useEffect(() => {
    flushProgress();
    const curr = videos[activeIndex];
    activeVideoRef.current = curr || null;
    activeDurationRef.current = curr?.duration_seconds || 30;
    hasRecorded50PercentRef.current = false;
  }, [activeIndex, videos, flushProgress]);

  // Clean up all players on complete unmount
  useEffect(() => {
    const pool = poolRef.current;
    return () => {
      flushProgress();
      pool.forEach((entry) => {
        try {
          entry.player?.destroy();
        } catch {
          // ignore
        }
      });
      pool.clear();
    };
  }, [flushProgress]);

  // Programmatically pause all V1 players (mutual exclusion with V2)
  const pauseAllV1Players = useCallback(() => {
    poolRef.current.forEach((entry) => {
      try {
        entry.player?.mute?.();
        entry.player?.pauseVideo?.();
      } catch {
        // ignore
      }
    });
  }, []);

  // Attach a player instance to a slot container element (STABLE CALLBACK)
  const attachPlayer = useCallback(
    (index: number, containerEl: HTMLDivElement | null) => {
      if (!containerEl) {
        // Only destroy if slot is outside the sliding cache window [activeIndex - 1, activeIndex + 2]
        const currentActive = activeIndexRef.current;
        if (index < currentActive - 1 || index > currentActive + 2) {
          const existing = poolRef.current.get(index);
          if (existing) {
            try {
              existing.player?.destroy();
            } catch {
              // ignore
            }
            poolRef.current.delete(index);
          }
        }
        return;
      }

      const video = videosRef.current[index];
      if (!video) return;

      const existing = poolRef.current.get(index);
      if (existing) {
        if (existing.videoId === video.youtube_video_id) {
          // Player already exists for this video. If detached, re-attach iframe cleanly without re-initializing!
          try {
            const iframe = existing.player?.getIframe?.();
            if (iframe && !containerEl.contains(iframe)) {
              existing.containerEl = containerEl;
              containerEl.replaceChildren(iframe);
            }
          } catch {
            // ignore
          }

          if (index === activeIndexRef.current && existing.isReady) {
            try {
              existing.player?.playVideo?.();
            } catch {
              // ignore
            }
          }
          return;
        }

        // Different video assigned to this slot: tear down old player
        try {
          existing.player?.destroy();
        } catch {
          // ignore
        }
        poolRef.current.delete(index);
      }

      loadYouTubeIframeApi().then(() => {
        if (!containerEl || !document.body.contains(containerEl)) return;

        // Double check if created concurrently
        if (poolRef.current.has(index)) return;

        containerEl.innerHTML = '';
        const hostDiv = document.createElement('div');
        hostDiv.className = 'w-full h-full pointer-events-none select-none';
        containerEl.appendChild(hostDiv);

        const isCurrentlyActive = index === activeIndexRef.current;

        const player = new window.YT.Player(hostDiv, {
          videoId: video.youtube_video_id,
          playerVars: {
            autoplay: isCurrentlyActive ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            cc_load_policy: 3,
            playsinline: 1,
            fs: 0,
            disablekb: 1,
            enablejsapi: 1,
            loop: 1,
            playlist: video.youtube_video_id,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: (event: any) => {
              const entry = poolRef.current.get(index);
              if (entry) {
                entry.isReady = true;
              }

              if (index === activeIndexRef.current) {
                if (hasUserGestureUnlockedRef.current && !isMutedRef.current) {
                  event.target.unMute();
                  event.target.setVolume(100);
                } else {
                  event.target.mute();
                }
                event.target.playVideo();
              } else {
                // Preload buffering: Mute and start buffering ahead of time
                event.target.mute();
                try {
                  event.target.playVideo();
                } catch {
                  // ignore
                }
              }
            },
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                const entry = poolRef.current.get(index);
                if (index === activeIndexRef.current) {
                  setPlayingIndices((prev) => ({ ...prev, [index]: true }));
                } else {
                  // Primed upcoming video: now that first bytes/frame are buffered, pause quietly!
                  if (entry && !entry.isPrimed) {
                    entry.isPrimed = true;
                    try {
                      event.target.pauseVideo();
                      event.target.seekTo(0, true);
                    } catch {
                      // ignore
                    }
                  }
                }
              }
            },
            onError: (event: any) => {
              const errMsg = `YouTube Error code ${event.data}`;
              console.warn(
                `[ShortsPlayer] YouTube error ${event.data} on video ${video.youtube_video_id} (index ${index}).`
              );
              const entry = poolRef.current.get(index);
              if (entry) {
                entry.hasError = true;
                entry.errorMessage = errMsg;
              }
              setErrorMap((prev) => ({ ...prev, [index]: errMsg }));
              onSkipErrorRef.current?.(index);
            },
          },
        });

        poolRef.current.set(index, {
          player,
          videoId: video.youtube_video_id,
          containerEl,
          hostDiv,
          isReady: false,
          isPrimed: false,
          hasError: false,
          errorMessage: null,
        });
      });
    },
    [] // Stable callback! Never changes across rerenders or activeIndex changes!
  );

  // Synchronize playback and audio when activeIndex, isMuted, or gesture unlock changes
  useEffect(() => {
    poolRef.current.forEach((entry, idx) => {
      if (!entry.isReady || !entry.player) return;

      try {
        if (idx === activeIndex) {
          if (hasUserGestureUnlocked && !isMuted) {
            entry.player.unMute?.();
            entry.player.setVolume?.(100);
          } else {
            entry.player.mute?.();
          }
          entry.player.playVideo?.();

          // If already playing in memory, reflect in state immediately
          if (entry.player.getPlayerState?.() === 1) {
            setPlayingIndices((prev) => ({ ...prev, [idx]: true }));
          }
        } else {
          entry.player.mute?.();
          entry.player.pauseVideo?.();
          entry.player.seekTo?.(0, true);
        }
      } catch {
        // Ignore postMessage iframe timing races
      }
    });

    // Prune entries outside [activeIndex - 1, activeIndex + 2] window
    const keepSlots = new Set([
      activeIndex - 1,
      activeIndex,
      activeIndex + 1,
      activeIndex + 2,
    ]);
    poolRef.current.forEach((entry, idx) => {
      if (!keepSlots.has(idx)) {
        try {
          entry.player?.destroy();
        } catch {
          // ignore
        }
        poolRef.current.delete(idx);
      }
    });
  }, [activeIndex, isMuted, hasUserGestureUnlocked]);

  // Handle tap gesture anywhere on the video
  const handleUserGesturePlayback = useCallback(() => {
    const entry = poolRef.current.get(activeIndex);
    if (!entry?.player) return;

    try {
      if (!hasUserGestureUnlocked) {
        // First tap unlocks audio for the entire session
        setGestureUnlocked(true);
        entry.player.unMute();
        entry.player.setVolume(100);
        entry.player.playVideo();
      } else {
        // Subsequent taps toggle play / pause
        const state = entry.player.getPlayerState?.();
        if (state === 1) {
          entry.player.pauseVideo();
        } else {
          entry.player.playVideo();
        }
      }
    } catch {
      // ignore
    }
  }, [activeIndex, hasUserGestureUnlocked, setGestureUnlocked]);

  // Explicit retry action for V1
  const retryV1Player = useCallback(
    (index: number) => {
      const entry = poolRef.current.get(index);
      if (entry) {
        try {
          entry.player?.destroy();
        } catch {
          // ignore
        }
        poolRef.current.delete(index);
      }
      setErrorMap((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });

      const video = videosRef.current[index];
      if (!video) return;

      // Re-trigger attach
      if (entry?.containerEl) {
        attachPlayer(index, entry.containerEl);
      }
    },
    [attachPlayer]
  );

  // Heartbeat progress tracking timer (1 sec)
  useEffect(() => {
    const timer = setInterval(() => {
      const activeEntry = poolRef.current.get(activeIndex);
      if (!activeEntry?.isReady || !activeEntry.player) return;

      try {
        const state = activeEntry.player.getPlayerState?.();
        if (state === 1) {
          // PLAYING
          const currentTime = activeEntry.player.getCurrentTime?.() || 0;
          const duration =
            activeEntry.player.getDuration?.() || activeDurationRef.current || 30;

          if (duration > 0) {
            const pct = Math.min(100, Math.round((currentTime / duration) * 100));
            setProgressMap((prev) => ({ ...prev, [activeIndex]: pct }));

            watchedSecondsRef.current += 1;
            maxPercentRef.current = Math.max(maxPercentRef.current, pct);

            // Record watch progress once >= 50%
            if (pct >= 50 && !hasRecorded50PercentRef.current) {
              hasRecorded50PercentRef.current = true;
              const video = activeVideoRef.current;
              if (video) {
                recordShortProgress(video.id, watchedSecondsRef.current, pct);
              }
            }
          }
        }
      } catch {
        // Player state poll error
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIndex]);

  return {
    attachPlayer,
    pauseAllV1Players,
    playingIndices,
    errorMap,
    progressMap,
    handleUserGesturePlayback,
    retryV1Player,
  };
}
