'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
} from 'lucide-react';
import { confirmedPlayback, pauseActivity, selectActivityVideo } from '@/lib/activity/childActivity';
import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';
import { syncThemeColorMeta } from '@/hooks/useTheme';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
  onEnded?: () => void;
  childId?: string;
  videoDbId?: string;
  channelId?: string;
  accessToken?: string;
  startAt?: number;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024)
  );
}

export function YouTubePlayer({
  videoId,
  title,
  autoplay = true,
  onEnded,
  childId,
  videoDbId,
  channelId,
  accessToken,
  startAt,
}: YouTubePlayerProps) {
  useEffect(() => { selectActivityVideo(videoId); }, [videoId]);
  const titleRef = useRef(title);
  titleRef.current = title;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Heartbeat tracking refs
  const accumulatedSecondsRef = useRef<number>(0);
  const latestPropsRef = useRef({ childId, videoDbId, channelId, accessToken });

  useEffect(() => {
    latestPropsRef.current = { childId, videoDbId, channelId, accessToken };
  }, [childId, videoDbId, channelId, accessToken]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isApiReady, setIsApiReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const isSeekingRef = useRef(false);
  const seekPreviewRef = useRef(0);
  const isPlayerReadyRef = useRef(false);
  const useRotationFallbackRef = useRef(false);
  /* Item 6: Track whether we need the CSS rotation fallback (iOS Safari, etc.) */
  const [useRotationFallback, setUseRotationFallback] = useState(false);
  useEffect(() => {
    useRotationFallbackRef.current = useRotationFallback;
  }, [useRotationFallback]);
  /* Item 9: Skip overlay animation state */
  const [skipAnim, setSkipAnim] = useState<{ side: 'left' | 'right'; key: number } | null>(null);
  /* Item 9: Double-tap tracking */
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);

  // Auto-hide controls timer
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);

    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3200);
  }, []);

  const handleInteraction = () => {
    scheduleHideControls();
  };

  // Heartbeat flush function
  const flushHeartbeat = useCallback(() => {
    const { childId: cid, videoDbId: vid, channelId: chid, accessToken: token } = latestPropsRef.current;
    if (!cid || !vid || !chid || !token) return;

    const delta = Math.floor(accumulatedSecondsRef.current);
    if (delta < 1) return;

    accumulatedSecondsRef.current = 0;

    const currentTimeVal = playerRef.current?.getCurrentTime?.() ?? 0;
    const durationVal = playerRef.current?.getDuration?.() ?? 0;

    const payload = {
      video_id: vid,
      channel_id: chid,
      delta_seconds: delta,
      absolute_position: typeof currentTimeVal === 'number' ? currentTimeVal : 0,
      video_duration: typeof durationVal === 'number' ? Math.floor(durationVal) : 0,
      beat_timestamp: new Date().toISOString(),
    };

    const url = '/api/watch-progress';

    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((err) => {
        console.debug('Heartbeat flush error:', err);
      });
    } catch {
      // ignore
    }
  }, []);

  // Flush on tab hide or page unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushHeartbeat();
      }
    };
    const handleBeforeUnload = () => {
      flushHeartbeat();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushHeartbeat();
    };
  }, [flushHeartbeat]);

  // Load YouTube IFrame API script
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevOnReady) prevOnReady();
      setIsApiReady(true);
    };
  }, []);

  // Initialize YT.Player
  useEffect(() => {
    if (!isApiReady || !videoId) return;

    // Validate YouTube Video ID (must be a valid 11-char string, e.g. dQw4w9WgXcQ)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      console.warn(`[YouTubePlayer] Invalid YouTube video ID passed: "${videoId}". Aborting player initialization.`);
      setIsBuffering(false);
      return;
    }

    let isMounted = true;
    isPlayerReadyRef.current = false;
    setPlayerError(false);
    const playerElementId = `yt-player-${videoId}`;

    // Clean up previous player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }

    try {
      const player = new window.YT.Player(playerElementId, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0, // Hides native YouTube controls, removing "Watch on YouTube"
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          fs: 1,
          disablekb: 1,
          enablejsapi: 1,
          playsinline: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          ...(startAt && startAt > 0 ? { start: Math.floor(startAt) } : {}),
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            isPlayerReadyRef.current = true;
            playerRef.current = event.target;
            const dur = event.target.getDuration();
            if (dur) setDuration(dur);
            if (startAt && startAt > 0) {
              try {
                event.target.seekTo(startAt, true);
              } catch {
                // ignore
              }
            }
            setIsBuffering(false);
            if (autoplay) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            if (!isMounted) return;
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            if (event.data !== 1) pauseActivity(videoId, event.data === 0);
            if (event.data === 1) {
              confirmedPlayback(videoId, titleRef.current);
              setIsPlaying(true);
              setIsBuffering(false);
              scheduleHideControls();
            } else if (event.data === 2) {
              setIsPlaying(false);
              setIsBuffering(false);
              setShowControls(true);
              flushHeartbeat();
            } else if (event.data === 3) {
              setIsBuffering(true);
            } else if (event.data === 0) {
              setIsPlaying(false);
              setIsBuffering(false);
              setShowControls(true);
              flushHeartbeat();
              if (onEnded) onEnded();
            } else if (event.data === 5 || (event.data === -1 && isPlayerReadyRef.current)) {
              setIsPlaying(false);
              setIsBuffering(false);
              setShowControls(true);
            } else if (event.data === -1) {
              setIsPlaying(false);
            }
          },
          onError: (event: any) => {
            if (!isMounted) return;
            pauseActivity(videoId);
            console.warn('[YouTubePlayer] YT.Player error event:', event?.data);
            setIsBuffering(false);
            setPlayerError(true);
          },
        },
      });

      playerRef.current = player;
    } catch (err) {
      console.error('[YouTubePlayer] Exception initializing YT.Player:', err);
      if (isMounted) {
        setIsBuffering(false);
        setPlayerError(true);
      }
    }

    return () => {
      isMounted = false;
      pauseActivity(videoId);
      flushHeartbeat();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [isApiReady, videoId, autoplay, onEnded, scheduleHideControls, startAt, flushHeartbeat]);

  // Polling current playback time — Item 8: reduced to 100ms for smoother progress bar
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && !isSeeking) {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === 'number') setCurrentTime(time);
        const dur = playerRef.current.getDuration();
        if (typeof dur === 'number' && dur > 0) setDuration(dur);

        // Heartbeat accumulation: only when player state is playing (1)
        if (playerRef.current.getPlayerState?.() === 1) {
          accumulatedSecondsRef.current += 0.1;
          if (accumulatedSecondsRef.current >= 10) {
            flushHeartbeat();
          }
        }
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSeeking, flushHeartbeat]);

  // ── Exit fullscreen callback ──
  const exitFullscreen = useCallback(async () => {
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {
      // ignore
    }
    setIsFullscreen(false);
    setUseRotationFallback(false);
    useUIStore.getState().setPlayerFullscreen(false);
    syncThemeColorMeta();
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    }
  }, []);

  // ── Landscape Fullscreen: Mobile In-App Viewport + Desktop Fullscreen API ──
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (isFullscreen) {
      await exitFullscreen();
      if (typeof window !== 'undefined' && window.history.state?.jrujuFullscreen) {
        window.history.back();
      }
      return;
    }

    const mobile = isMobileDevice();

    if (mobile) {
      // On mobile / installed PWA: Use CSS Viewport Fullscreen instead of HTML5 document.requestFullscreen().
      // This completely avoids the persistent Android Chrome security banner:
      // "jrujutv.onrender.com — to exit full screen, drag from the top and touch the back button".
      setIsFullscreen(true);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }

      // Push history state so Android physical / gesture back button cleanly exits fullscreen
      try {
        window.history.pushState({ jrujuFullscreen: true }, '');
      } catch {
        // ignore
      }

      // Try orientation lock if supported without OS fullscreen (e.g. standalone PWA)
      let locked = false;
      if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
        try {
          await (screen.orientation as any).lock('landscape');
          locked = true;
        } catch {
          // Standard mobile Chrome requires requestFullscreen for orientation.lock
        }
      }

      const isLandscape = typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false;

      // If not locked and in portrait, rotate 90° with CSS to display in landscape
      if (!locked && !isLandscape) {
        setUseRotationFallback(true);
      } else {
        setUseRotationFallback(false);
      }
    } else {
      // Desktop: Standard HTML5 Fullscreen API
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen error:', err);
        // Fallback to in-app fullscreen
        setIsFullscreen(true);
      }
    }
  }, [isFullscreen, exitFullscreen]);

  // Desktop HTML5 Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      if (!isFs && !isMobileDevice()) {
        setIsFullscreen(false);
        setUseRotationFallback(false);
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // PopState listener — pressing Android back button / gesture exits fullscreen
  useEffect(() => {
    const handlePopState = () => {
      if (isFullscreen) {
        exitFullscreen();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isFullscreen, exitFullscreen]);

  // Orientation change / window resize listener when in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleOrientationOrResize = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        // Device is physically in landscape — no rotation transform needed
        setUseRotationFallback(false);
      } else if (isMobileDevice()) {
        // Device is held in portrait — rotate 90° with CSS
        setUseRotationFallback(true);
      }
    };

    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
    };
  }, [isFullscreen]);

  // Keyboard shortcut listener ('f' to toggle fullscreen, 'Escape' to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen, exitFullscreen, isFullscreen]);

  // ── Status Bar & Fullscreen Synchronization ──
  // Rule: When video player is in fullscreen, status bar background MUST ALWAYS BE BLACK (#000000),
  // regardless of whether the site is in light mode or dark mode!
  // When exiting fullscreen, it must restore to the active theme (#0F0F0F if dark, #FFFFFF if light).
  useEffect(() => {
    useUIStore.getState().setPlayerFullscreen(isFullscreen);
    syncThemeColorMeta(isFullscreen ? '#000000' : undefined);

    if (isFullscreen) {
      if (typeof document !== 'undefined') {
        document.documentElement.style.backgroundColor = '#000000';
        document.body.style.backgroundColor = '#000000';
      }
    } else {
      if (typeof document !== 'undefined') {
        document.documentElement.style.backgroundColor = '';
        document.body.style.backgroundColor = '';
      }
    }

    return () => {
      useUIStore.getState().setPlayerFullscreen(false);
      syncThemeColorMeta();
      if (typeof document !== 'undefined') {
        document.documentElement.style.backgroundColor = '';
        document.body.style.backgroundColor = '';
      }
    };
  }, [isFullscreen]);

  // Clean up body scroll lock, fullscreen status, and orientation lock on unmount
  useEffect(() => {
    return () => {
      useUIStore.getState().setPlayerFullscreen(false);
      syncThemeColorMeta();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.documentElement.style.backgroundColor = '';
        document.body.style.backgroundColor = '';
      }
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {
        // ignore
      }
    };
  }, []);


  /* ── Resume / start playback from center play button ── */
  const handlePlayResume = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const player = playerRef.current;
    if (!player) return;

    try {
      const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : undefined;
      if (state === 0 && typeof player.seekTo === 'function') {
        player.seekTo(0, true);
      }
      if (typeof player.playVideo === 'function') {
        player.playVideo();
      }
      scheduleHideControls();
    } catch (err) {
      console.warn('[YouTubePlayer] Failed to resume playback:', err);
    }
  }, [scheduleHideControls]);

  /* ── Item 9: Skip ±10s ── */
  const skipTime = (delta: number) => {
    if (!playerRef.current) return;
    flushHeartbeat();
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    setCurrentTime(newTime);
    playerRef.current.seekTo(newTime, true);
    scheduleHideControls();
  };

  /* Item 9: Handle tap/double-tap on video overlay.
     Single tap → show/hide controls. Double tap on left → -10s, double tap on right → +10s */
  const handleOverlayTap = (side: 'left' | 'right') => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && last.side === side && now - last.time < 350) {
      // Double tap detected — skip
      lastTapRef.current = null;
      skipTime(side === 'left' ? -10 : 10);
      setSkipAnim({ side, key: now });
      setTimeout(() => setSkipAnim(null), 600);
    } else {
      // Single tap — toggle controls visibility
      lastTapRef.current = { time: now, side };
      // Delay to check if it becomes a double tap
      setTimeout(() => {
        if (lastTapRef.current && lastTapRef.current.time === now) {
          lastTapRef.current = null;
          scheduleHideControls();
        }
      }, 350);
    }
  };

  /* ── Item 8: Custom progress bar seek handling (supports 90deg rotated fullscreen fallback) ── */
  const getSeekPositionFromEvent = (clientX: number, clientY: number): number => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    let fraction: number;
    if (useRotationFallbackRef.current) {
      // Container is rotated 90deg clockwise: visual left-to-right is viewport top-to-bottom
      fraction = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
    } else {
      fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    }
    fraction = Math.max(0, Math.min(1, fraction));
    return fraction * duration;
  };

  const handleSeekStart = (clientX: number, clientY: number) => {
    flushHeartbeat();
    isSeekingRef.current = true;
    setIsSeeking(true);
    const time = getSeekPositionFromEvent(clientX, clientY);
    seekPreviewRef.current = time;
    setSeekPreview(time);
    setCurrentTime(time);
  };

  const handleSeekMove = (clientX: number, clientY: number) => {
    if (!isSeekingRef.current) return;
    const time = getSeekPositionFromEvent(clientX, clientY);
    seekPreviewRef.current = time;
    setSeekPreview(time);
    setCurrentTime(time);
  };

  const handleSeekEnd = () => {
    if (!isSeekingRef.current) return;
    isSeekingRef.current = false;
    setIsSeeking(false);
    const targetTime = seekPreviewRef.current;
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(targetTime, true);
    }
  };

  // Mouse handlers for seek bar
  const onProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSeekStart(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => handleSeekMove(ev.clientX, ev.clientY);
    const onUp = () => {
      handleSeekEnd();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Touch handlers for seek bar
  const onProgressTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (touch) handleSeekStart(touch.clientX, touch.clientY);
  };

  const onProgressTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (touch) handleSeekMove(touch.clientX, touch.clientY);
  };

  const onProgressTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    handleSeekEnd();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    if (playerRef.current) {
      playerRef.current.setVolume(newVol);
      if (newVol === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
      playerRef.current.setVolume(volume > 0 ? volume : 50);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const progressFraction = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative w-full aspect-video bg-black overflow-hidden select-none group',
        /* Fullscreen handling */
        isFullscreen && !useRotationFallback && 'player-fullscreen-landscape',
        isFullscreen && useRotationFallback && 'player-rotate-landscape'
      )}
    >
      {/* ── 1. The Underlying YouTube IFrame ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div id={`yt-player-${videoId}`} className="w-full h-full" />
      </div>

      {/* ── 2. Click Intercept Overlay — Item 5: No pause on tap. Item 9: Double-tap skip zones ── */}
      {/* Left half — double tap to skip back 10s */}
      <button
        type="button"
        aria-label="Double tap to skip back 10 seconds"
        onClick={() => handleOverlayTap('left')}
        className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer bg-transparent focus:outline-none"
      />
      {/* Right half — double tap to skip forward 10s */}
      <button
        type="button"
        aria-label="Double tap to skip forward 10 seconds"
        onClick={() => handleOverlayTap('right')}
        className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer bg-transparent focus:outline-none"
      />

      {/* ── Item 9: Skip animation overlay ── */}
      {skipAnim && (
        <div
          key={skipAnim.key}
          className={cn(
            'absolute z-20 pointer-events-none flex items-center justify-center',
            'animate-in fade-in zoom-in-75 duration-300',
            skipAnim.side === 'left' ? 'inset-y-0 left-0 w-1/2' : 'inset-y-0 right-0 w-1/2'
          )}
        >
          <div className="flex flex-col items-center gap-1 text-white">
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {skipAnim.side === 'left' ? <RotateCcw size={28} /> : <RotateCw size={28} />}
            </div>
            <span className="text-xs font-bold drop-shadow-lg">10s</span>
          </div>
        </div>
      )}

      {/* ── 3. Buffering / Loading Spinner ── */}
      {isBuffering && !playerError && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <Loader2 className="h-12 w-12 text-brand-primary animate-spin" />
        </div>
      )}

      {/* ── 3a. Paused / Stopped Play Button — clickable to resume or start playback ── */}
      {!isPlaying && !isBuffering && !playerError && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <button
            type="button"
            onClick={handlePlayResume}
            aria-label="Play video"
            title="Play video"
            className="pointer-events-auto h-16 w-16 rounded-full bg-black/60 hover:bg-black/75 active:scale-95 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white translate-x-0.5">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
        </div>
      )}

      {/* ── 3b. Player Error Overlay ── */}
      {playerError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center space-y-2">
          <p className="font-semibold text-fluid-base">Video Playback Unavailable</p>
          <p className="text-fluid-xs text-white/70 max-w-sm">
            This video cannot be played directly or is restricted by YouTube.
          </p>
        </div>
      )}

      {/* ── 4. Custom Control Bar — high contrast over bright & dark footage ── */}
      <div
        className={cn(
          'player-controls absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/65 to-transparent transition-opacity duration-300 pointer-events-auto',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* ── Item 8: Custom continuous progress bar with generous touch target ── */}
        <div
          ref={progressBarRef}
          className="relative w-full h-8 flex items-center cursor-pointer touch-none mb-1 group/scrub"
          onMouseDown={onProgressMouseDown}
          onTouchStart={onProgressTouchStart}
          onTouchMove={onProgressTouchMove}
          onTouchEnd={onProgressTouchEnd}
          role="slider"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
        >
          {/* Track background */}
          <div className="absolute left-0 right-0 h-1.5 group-hover/scrub:h-2 rounded-full bg-white/30 transition-all shadow-xs" />
          {/* Filled segment (red) */}
          <div
            className="absolute left-0 h-1.5 group-hover/scrub:h-2 rounded-full bg-red-600 transition-all"
            style={{ width: `${progressFraction}%` }}
          />
          {/* Scrub handle */}
          <div
            className={cn(
              'absolute h-4 w-4 rounded-full bg-red-600 border-2 border-white shadow-md -translate-x-1/2 transition-transform',
              'opacity-80 sm:opacity-0 group-hover/scrub:opacity-100',
              isSeeking && 'opacity-100 scale-125'
            )}
            style={{ left: `${progressFraction}%` }}
          />
        </div>

        {/* Buttons and Time */}
        <div className="flex items-center justify-between gap-2 text-white text-xs sm:text-sm">
          {/* Left group */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Skip -10s */}
            <button
              type="button"
              onClick={() => skipTime(-10)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-black/30 hover:bg-white/15 active:scale-95 transition-all text-white drop-shadow"
              title="Back 10 seconds"
              aria-label="Skip backward 10 seconds"
            >
              <RotateCcw size={18} />
            </button>

            {/* Skip +10s */}
            <button
              type="button"
              onClick={() => skipTime(10)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-black/30 hover:bg-white/15 active:scale-95 transition-all text-white drop-shadow"
              title="Forward 10 seconds"
              aria-label="Skip forward 10 seconds"
            >
              <RotateCw size={18} />
            </button>

            {/* Volume & Mute */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-black/30 hover:bg-white/15 active:scale-95 transition-all text-white drop-shadow"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
              {!useRotationFallback && (
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume"
                  className="w-14 sm:w-20 h-1.5 bg-white/35 rounded-lg appearance-none cursor-pointer accent-brand-primary hidden sm:block"
                />
              )}
            </div>

            {/* Time Stamp */}
            <span className="text-[11px] sm:text-xs font-mono font-semibold text-white drop-shadow pl-1 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right group: Fullscreen */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-black/30 hover:bg-white/15 active:scale-95 transition-all text-white drop-shadow"
              title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
