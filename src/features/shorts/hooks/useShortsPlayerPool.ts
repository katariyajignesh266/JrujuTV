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

// ── Singleton YouTube IFrame API Loader ─────────────────────────────────────────
let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();

  if (!ytApiPromise) {
    ytApiPromise = new Promise<void>((resolve) => {
      // Check if tag already exists in DOM
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

      // Safety polling interval in case ready event fired prior to listener assignment
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
  isReady: boolean;
}

export function useShortsPlayerPool(
  videos: ShortVideo[],
  onSkipError?: (index: number) => void
) {
  const { isMuted, activeIndex, toggleMute } = useShortsFeatureStore();
  const poolRef = useRef<Map<number, PlayerPoolEntry>>(new Map());
  const [playingIndices, setPlayingIndices] = useState<Record<number, boolean>>({});
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});

  // Heartbeat tracking
  const activeVideoRef = useRef<ShortVideo | null>(null);
  const activeDurationRef = useRef<number>(0);
  const maxPercentRef = useRef<number>(0);
  const watchedSecondsRef = useRef<number>(0);
  const hasRecorded50PercentRef = useRef<boolean>(false);

  // Preload YouTube API once
  useEffect(() => {
    loadYouTubeIframeApi();
  }, []);

  // Flush watch progress for active video
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

  // Update active video reference on index change
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

  // Attach player for a slot container
  const attachPlayer = useCallback(
    (index: number, containerEl: HTMLDivElement | null) => {
      if (!containerEl) {
        // Detach container & destroy instance
        const existing = poolRef.current.get(index);
        if (existing) {
          try {
            existing.player?.destroy();
          } catch {
            // ignore
          }
          poolRef.current.delete(index);
        }
        return;
      }

      const video = videos[index];
      if (!video) return;

      const existing = poolRef.current.get(index);
      if (
        existing &&
        existing.videoId === video.youtube_video_id &&
        existing.containerEl === containerEl
      ) {
        return;
      }

      // Destroy stale player if video changed
      if (existing) {
        try {
          existing.player?.destroy();
        } catch {
          // ignore
        }
        poolRef.current.delete(index);
      }

      loadYouTubeIframeApi().then(() => {
        if (!containerEl || !document.body.contains(containerEl)) return;

        // Clear container and create dedicated mount div
        containerEl.innerHTML = '';
        const hostDiv = document.createElement('div');
        hostDiv.className = 'w-full h-full pointer-events-none select-none';
        containerEl.appendChild(hostDiv);

        const isCurrentlyActive = index === activeIndex;

        const player = new window.YT.Player(hostDiv, {
          videoId: video.youtube_video_id,
          playerVars: {
            autoplay: isCurrentlyActive ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
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

              if (index === activeIndex) {
                if (isMuted) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                }
                event.target.playVideo();
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[ShortsPlayer] Slot ${index} (${video.youtube_video_id}) is READY & PLAYING`);
                }
              } else {
                event.target.mute();
                event.target.pauseVideo();
              }
            },
            onStateChange: (event: any) => {
              // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
              if (event.data === window.YT.PlayerState.PLAYING) {
                setPlayingIndices((prev) => ({ ...prev, [index]: true }));
              }
            },
            onError: (event: any) => {
              const errorCode = event.data;
              console.warn(
                `[ShortsPlayer] YouTube error ${errorCode} on video ${video.youtube_video_id}. Auto-skipping...`
              );
              onSkipError?.(index);
            },
          },
        });

        poolRef.current.set(index, {
          player,
          videoId: video.youtube_video_id,
          containerEl,
          isReady: false,
        });
      });
    },
    [videos, activeIndex, isMuted, onSkipError]
  );

  // Synchronize playback & audio when activeIndex or isMuted changes
  useEffect(() => {
    poolRef.current.forEach((entry, idx) => {
      if (!entry.isReady || !entry.player) return;

      try {
        if (idx === activeIndex) {
          if (isMuted) {
            entry.player.mute?.();
          } else {
            entry.player.unMute?.();
          }
          entry.player.playVideo?.();
        } else {
          entry.player.mute?.();
          entry.player.pauseVideo?.();
          entry.player.seekTo?.(0, true);
        }
      } catch (e) {
        // Ignore postMessage iframe timing races
      }
    });

    // Prune entries outside [activeIndex - 1, activeIndex + 1] window
    const keepSlots = new Set([activeIndex - 1, activeIndex, activeIndex + 1]);
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
  }, [activeIndex, isMuted]);

  // User gesture tap fallback to start/unmute playback
  const handleUserGesturePlayback = useCallback(() => {
    const entry = poolRef.current.get(activeIndex);
    if (entry?.player) {
      try {
        if (isMuted) {
          toggleMute();
          entry.player.unMute();
        }
        entry.player.playVideo();
      } catch (e) {
        // ignore
      }
    }
  }, [activeIndex, isMuted, toggleMute]);

  // Heartbeat timer for active video progress tracking
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

            // Once watched reaches 50%, persist progress to database exactly once
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
    playingIndices,
    progressMap,
    handleUserGesturePlayback,
  };
}
