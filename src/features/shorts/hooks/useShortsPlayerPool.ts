// src/features/shorts/hooks/useShortsPlayerPool.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShortsFeatureStore } from '../store/shortsStore';
import { recordShortProgress, reportUnplayableShort } from '../api/shortsApi';
import { ShortVideo, ShortPlaybackState, ShortDiagnosticLog } from '../types';

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
  youtubeId: string;
  containerEl: HTMLDivElement;
  hostDiv: HTMLDivElement;
  isReady: boolean;
  isPrimed: boolean;
  hasError: boolean;
  errorMessage: string | null;
  state: ShortPlaybackState;
  stateTransitions: { state: ShortPlaybackState; timestamp: number }[];
  watchdogTimer: NodeJS.Timeout | null;
  retriedOnce: boolean;
  mountToken: number;
  timeToFirstFrameMs: number | null;
  startTime: number;
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
  const [statusMap, setStatusMap] = useState<Record<number, ShortPlaybackState>>({});

  // Structured diagnostic history for ?debug=1 (zero cost when not exported)
  const diagnosticLogsRef = useRef<Map<number, ShortDiagnosticLog>>(new Map());

  // Heartbeat tracking for watch progress
  const activeVideoRef = useRef<ShortVideo | null>(null);
  const activeDurationRef = useRef<number>(30);
  const watchedSecondsRef = useRef<number>(0);
  const maxPercentRef = useRef<number>(0);
  const hasRecorded50PercentRef = useRef<boolean>(false);

  // Live stable references to prevent unnecessary callback invalidations & stale closures
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

  // Mount generation token per slot to invalidate late async events from discarded mounts
  const mountTokensRef = useRef<Map<number, number>>(new Map());

  // Load YouTube API script once on mount
  useEffect(() => {
    loadYouTubeIframeApi();
  }, []);

  // Update diagnostic entry
  const recordTransition = useCallback((index: number, state: ShortPlaybackState, extra?: Partial<ShortDiagnosticLog>) => {
    const entry = poolRef.current.get(index);
    const now = Date.now();
    if (entry) {
      entry.state = state;
      entry.stateTransitions.push({ state, timestamp: now });
    }
    setStatusMap((prev) => ({ ...prev, [index]: state }));

    const video = videosRef.current[index];
    const existingLog = diagnosticLogsRef.current.get(index) || {
      index,
      videoId: video?.id || '',
      youtubeId: video?.youtube_video_id || '',
      source: 'V1',
      state,
      stateTransitions: [],
      errorCode: null,
      errorMessage: null,
      timeToFirstFrameMs: null,
      poolState: 'INITIAL',
      watchdogTriggered: false,
      timestamp: new Date().toISOString(),
    };

    existingLog.state = state;
    existingLog.stateTransitions.push({ state, timestamp: now });
    if (extra) {
      Object.assign(existingLog, extra);
    }
    diagnosticLogsRef.current.set(index, existingLog);
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
    const diagnosticLogs = diagnosticLogsRef.current;
    return () => {
      flushProgress();
      pool.forEach((entry) => {
        if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer);
        try {
          entry.player?.destroy();
        } catch {
          // ignore
        }
      });
      pool.clear();
      diagnosticLogs.clear();
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

  // Teardown single entry safely
  const destroySlot = useCallback((index: number) => {
    const existing = poolRef.current.get(index);
    if (existing) {
      if (existing.watchdogTimer) clearTimeout(existing.watchdogTimer);
      try {
        existing.player?.destroy();
      } catch {
        // ignore
      }
      poolRef.current.delete(index);
      mountTokensRef.current.delete(index);

      setPlayingIndices((prev) => {
        if (!prev[index]) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setStatusMap((prev) => {
        if (!prev[index]) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }, []);

  // Safe play implementation with platform autoplay handling (iOS vs Android)
  const safePlayV1 = useCallback((player: any, index: number) => {
    if (index !== activeIndexRef.current || !player) return;

    try {
      if (hasUserGestureUnlockedRef.current && !isMutedRef.current) {
        try {
          player.unMute();
          player.setVolume(100);
        } catch {}
      } else {
        player.mute();
      }

      // iOS Safari and Android Chrome require explicit play handling
      player.playVideo();
    } catch (err) {
      console.warn(`[useShortsPlayerPool] safePlayV1 error on index ${index}:`, err);
      // Fallback: try muted playback immediately in case unmuted autoplay was rejected
      try {
        player.mute();
        player.playVideo();
      } catch {}
    }
  }, []);

  // Start or refresh playback watchdog for the currently active short
  const startActiveWatchdog = useCallback(
    (index: number, video?: ShortVideo) => {
      const entry = poolRef.current.get(index);
      if (!entry || !entry.player) return;

      if (entry.watchdogTimer) {
        clearTimeout(entry.watchdogTimer);
        entry.watchdogTimer = null;
      }

      const currentVid = video || videosRef.current[index];

      // Watchdog timeout: 4000ms gives adequate time for YouTube API buffer on mobile/WiFi without stalling
      entry.watchdogTimer = setTimeout(() => {
        const currentEntry = poolRef.current.get(index);
        if (!currentEntry || currentEntry.player !== entry.player) return;
        if (index !== activeIndexRef.current) return;

        try {
          const pState = currentEntry.player.getPlayerState?.();
          if (pState === 1 /* PLAYING */) {
            return;
          }

          console.warn(
            `[ShortsWatchdog] Short #${index} (${currentVid?.youtube_video_id}) not playing after 4s (state=${pState}). Attempting recovery...`
          );

          if (!currentEntry.retriedOnce) {
            currentEntry.retriedOnce = true;
            // Step 1: Force mute (bypasses browser autoplay policy) and call playVideo()
            try {
              currentEntry.player.mute();
              currentEntry.player.playVideo();
            } catch {}

            // Second-chance check after 3000ms
            currentEntry.watchdogTimer = setTimeout(() => {
              const reCheckEntry = poolRef.current.get(index);
              if (!reCheckEntry || reCheckEntry.player !== entry.player) return;
              if (index !== activeIndexRef.current) return;

              const reState = reCheckEntry.player.getPlayerState?.();
              if (reState === 1) return;

              console.warn(
                `[ShortsWatchdog] Short #${index} (${currentVid?.youtube_video_id}) recovery failed. Auto-advancing.`
              );
              recordTransition(index, 'ERROR', {
                watchdogTriggered: true,
                errorMessage: 'Playback stalled: video could not start',
              });
              setErrorMap((prev) => ({
                ...prev,
                [index]: 'Video unavailable or playback restricted',
              }));
              if (currentVid?.id) {
                reportUnplayableShort(currentVid.id, 'watchdog_timeout_recovery_failed');
              }
              onSkipErrorRef.current?.(index);
            }, 3000);
          } else {
            recordTransition(index, 'ERROR', {
              watchdogTriggered: true,
              errorMessage: 'Playback stalled: video could not start',
            });
            setErrorMap((prev) => ({
              ...prev,
              [index]: 'Video unavailable or playback restricted',
            }));
            if (currentVid?.id) {
              reportUnplayableShort(currentVid.id, 'watchdog_timeout');
            }
            onSkipErrorRef.current?.(index);
          }
        } catch (err) {
          console.warn(`[ShortsWatchdog] Error during watchdog check:`, err);
        }
      }, 4000);
    },
    [recordTransition]
  );

  // Attach a player instance to a slot container element (STABLE CALLBACK)
  const attachPlayer = useCallback(
    (index: number, containerEl: HTMLDivElement | null) => {
      if (!containerEl) {
        // Only destroy if slot is outside the sliding cache window [activeIndex - 1, activeIndex + 2]
        const currentActive = activeIndexRef.current;
        if (index < currentActive - 1 || index > currentActive + 2) {
          destroySlot(index);
        }
        return;
      }

      const video = videosRef.current[index];
      if (!video) return;

      const existing = poolRef.current.get(index);
      if (existing) {
        const iframe = existing.player?.getIframe?.();
        // If player already exists and its iframe is intact in containerEl, reuse it!
        if (existing.youtubeId === video.youtube_video_id && iframe && containerEl.contains(iframe)) {
          if (index === activeIndexRef.current && existing.isReady) {
            safePlayV1(existing.player, index);
            startActiveWatchdog(index, video);
          }
          return;
        }

        // Different video or iframe was detached from DOM: tear down cleanly before creating fresh
        destroySlot(index);
      }

      const nextToken = (mountTokensRef.current.get(index) ?? 0) + 1;
      mountTokensRef.current.set(index, nextToken);
      const currentToken = nextToken;
      recordTransition(index, 'LOADING');

      loadYouTubeIframeApi().then(() => {
        if (!containerEl || !document.body.contains(containerEl)) return;

        // Check if invalidated by newer attach call for this slot
        if (mountTokensRef.current.get(index) !== currentToken) return;
        if (poolRef.current.has(index)) return;

        containerEl.innerHTML = '';
        const hostDiv = document.createElement('div');
        hostDiv.id = `yt-shorts-player-${index}-${video.youtube_video_id}`;
        hostDiv.className = 'w-full h-full pointer-events-none select-none';
        containerEl.appendChild(hostDiv);

        const isCurrentlyActive = index === activeIndexRef.current;

        const entry: PlayerPoolEntry = {
          player: null,
          videoId: video.id,
          youtubeId: video.youtube_video_id,
          containerEl,
          hostDiv,
          isReady: false,
          isPrimed: false,
          hasError: false,
          errorMessage: null,
          state: 'LOADING',
          stateTransitions: [],
          watchdogTimer: null,
          retriedOnce: false,
          mountToken: currentToken,
          timeToFirstFrameMs: null,
          startTime: performance.now(),
        };

        const player = new window.YT.Player(hostDiv.id, {
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
              if (mountTokensRef.current.get(index) !== currentToken) return;

              entry.isReady = true;
              recordTransition(index, 'READY');

              if (index === activeIndexRef.current) {
                safePlayV1(event.target, index);
                startActiveWatchdog(index, video);
              } else {
                // Background player: mute so it is prepared, but do not play in background
                try {
                  event.target.mute();
                } catch {}
              }
            },
            onStateChange: (event: any) => {
              if (mountTokensRef.current.get(index) !== currentToken) return;

              if (event.data === window.YT.PlayerState.PLAYING) {
                if (entry.watchdogTimer) {
                  clearTimeout(entry.watchdogTimer);
                  entry.watchdogTimer = null;
                }

                if (entry.timeToFirstFrameMs === null) {
                  entry.timeToFirstFrameMs = Math.round(performance.now() - entry.startTime);
                }

                recordTransition(index, 'PLAYING', {
                  timeToFirstFrameMs: entry.timeToFirstFrameMs,
                });

                if (index === activeIndexRef.current) {
                  setPlayingIndices((prev) => ({ ...prev, [index]: true }));

                  // Restore volume if session audio is unlocked
                  if (hasUserGestureUnlockedRef.current && !isMutedRef.current) {
                    try {
                      entry.player?.unMute();
                      entry.player?.setVolume(100);
                    } catch {}
                  }
                } else {
                  // If background player somehow entered playing, pause quietly
                  try {
                    event.target.pauseVideo();
                    event.target.seekTo(0, true);
                  } catch {}
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                recordTransition(index, 'PAUSED');
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                recordTransition(index, 'WAITING');
              } else if (event.data === -1 /* UNSTARTED */ || event.data === 5 /* VIDEO_CUED */) {
                // Autoplay policy or cue state recovery
                if (index === activeIndexRef.current) {
                  setTimeout(() => {
                    if (index === activeIndexRef.current && entry.player) {
                      try {
                        entry.player.playVideo();
                      } catch {}
                    }
                  }, 150);
                }
              }
            },
            onError: (event: any) => {
              if (mountTokensRef.current.get(index) !== currentToken) return;
              if (entry.watchdogTimer) {
                clearTimeout(entry.watchdogTimer);
                entry.watchdogTimer = null;
              }

              const errCode = event.data;
              const errMsg =
                errCode === 101 || errCode === 150
                  ? 'Embedding disabled by owner'
                  : errCode === 100
                  ? 'Video not found or removed'
                  : errCode === 2
                  ? 'Invalid parameters'
                  : 'Playback error';

              console.warn(
                `[ShortsPlayer] YouTube error ${errCode} on video ${video.youtube_video_id} (index ${index}).`
              );

              entry.hasError = true;
              entry.errorMessage = errMsg;
              recordTransition(index, 'ERROR', {
                errorCode: errCode,
                errorMessage: errMsg,
              });

              setErrorMap((prev) => ({ ...prev, [index]: errMsg }));

              // Report unplayable short to Supabase DB so it is excluded
              reportUnplayableShort(video.id, `youtube_error_${errCode}`);

              // Notify parent for silent auto-skip to next short
              setTimeout(() => {
                if (index === activeIndexRef.current) {
                  onSkipErrorRef.current?.(index);
                }
              }, 400);
            },
          },
        });

        entry.player = player;
        poolRef.current.set(index, entry);
      });
    },
    [destroySlot, recordTransition, safePlayV1, startActiveWatchdog]
  );

  // Synchronize playback and audio when activeIndex, isMuted, or gesture unlock changes
  useEffect(() => {
    const currentActive = activeIndex;

    poolRef.current.forEach((entry, idx) => {
      if (!entry.player) return;

      try {
        if (idx === currentActive) {
          if (entry.isReady) {
            safePlayV1(entry.player, idx);
            startActiveWatchdog(idx, videosRef.current[idx]);

            // If already playing in memory, reflect in state immediately
            if (entry.player.getPlayerState?.() === 1) {
              setPlayingIndices((prev) => ({ ...prev, [idx]: true }));
            }
          }
          // If not ready yet, onReady will invoke safePlayV1 + startActiveWatchdog
        } else {
          if (entry.watchdogTimer) {
            clearTimeout(entry.watchdogTimer);
            entry.watchdogTimer = null;
          }
          entry.player.mute?.();
          entry.player.pauseVideo?.();
          entry.player.seekTo?.(0, true);
          setPlayingIndices((prev) => {
            if (!prev[idx]) return prev;
            const next = { ...prev };
            delete next[idx];
            return next;
          });
        }
      } catch {
        // Ignore postMessage iframe timing races
      }
    });

    // Prune entries outside [activeIndex - 1, activeIndex + 2] window
    const keepSlots = new Set([
      currentActive - 1,
      currentActive,
      currentActive + 1,
      currentActive + 2,
    ]);
    poolRef.current.forEach((_, idx) => {
      if (!keepSlots.has(idx)) {
        destroySlot(idx);
      }
    });
  }, [activeIndex, isMuted, hasUserGestureUnlocked, destroySlot, safePlayV1, startActiveWatchdog]);

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
          if (!isMuted) {
            try {
              entry.player.unMute();
              entry.player.setVolume(100);
            } catch {}
          }
          entry.player.playVideo();
        }
      }
    } catch {
      // ignore
    }
  }, [activeIndex, hasUserGestureUnlocked, isMuted, setGestureUnlocked]);

  // Explicit retry action for V1
  const retryV1Player = useCallback(
    (index: number) => {
      destroySlot(index);
      setErrorMap((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });

      const video = videosRef.current[index];
      if (!video) return;

      // Re-trigger attach
      setTimeout(() => {
        const containerEl = document.querySelector(
          `[data-index="${index}"] .shorts-player-frame`
        ) as HTMLDivElement;
        if (containerEl) {
          attachPlayer(index, containerEl);
        }
      }, 50);
    },
    [attachPlayer, destroySlot]
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

  // Expose diagnostic log collection for debug overlay
  const getDiagnosticLogs = useCallback((): ShortDiagnosticLog[] => {
    return Array.from(diagnosticLogsRef.current.values());
  }, []);

  return {
    attachPlayer,
    pauseAllV1Players,
    playingIndices,
    errorMap,
    progressMap,
    statusMap,
    handleUserGesturePlayback,
    retryV1Player,
    getDiagnosticLogs,
  };
}
