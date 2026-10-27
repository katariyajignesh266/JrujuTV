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
import { cn } from '@/lib/cn';

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
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  /* Item 6: Track whether we need the CSS rotation fallback (iOS Safari, etc.) */
  const [useRotationFallback, setUseRotationFallback] = useState(false);
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const url = `${supabaseUrl}/functions/v1/record-watch-progress`;

    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
            : {}),
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

    let isMounted = true;
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
          if (event.data === 1) {
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
          }
        },
        onError: () => {
          if (!isMounted) return;
          setIsBuffering(false);
        },
      },
    });

    playerRef.current = player;

    return () => {
      isMounted = false;
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
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
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

  // Clean up body scroll lock and orientation lock on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {
        // ignore
      }
    };
  }, []);


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

  /* ── Item 8: Custom progress bar seek handling ── */
  const getSeekPositionFromEvent = (clientX: number): number => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return fraction * duration;
  };

  const handleSeekStart = (clientX: number) => {
    flushHeartbeat();
    setIsSeeking(true);
    const time = getSeekPositionFromEvent(clientX);
    setSeekPreview(time);
    setCurrentTime(time);
  };

  const handleSeekMove = (clientX: number) => {
    if (!isSeeking) return;
    const time = getSeekPositionFromEvent(clientX);
    setSeekPreview(time);
    setCurrentTime(time);
  };

  const handleSeekEnd = () => {
    if (!isSeeking) return;
    setIsSeeking(false);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seekPreview, true);
    }
  };

  // Mouse handlers for seek bar
  const onProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSeekStart(e.clientX);
    const onMove = (ev: MouseEvent) => handleSeekMove(ev.clientX);
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
    handleSeekStart(touch.clientX);
  };

  const onProgressTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    handleSeekMove(touch.clientX);
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
            'absolute z-15 pointer-events-none flex items-center justify-center',
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
      {isBuffering && (
        <div className="absolute inset-0 z-15 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <Loader2 className="h-12 w-12 text-brand-primary animate-spin" />
        </div>
      )}

      {/* ── 4. Custom Control Bar — Item 5: No play/pause button ── */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 pointer-events-auto',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* ── Item 8: Custom continuous progress bar with filled red segment ── */}
        <div
          ref={progressBarRef}
          className="relative w-full h-6 flex items-center cursor-pointer mb-1 group/scrub"
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
          <div className="absolute left-0 right-0 h-1 group-hover/scrub:h-1.5 rounded-full bg-white/25 transition-all" />
          {/* Filled segment (red) */}
          <div
            className="absolute left-0 h-1 group-hover/scrub:h-1.5 rounded-full bg-red-600 transition-all"
            style={{ width: `${progressFraction}%` }}
          />
          {/* Scrub handle */}
          <div
            className={cn(
              'absolute h-3.5 w-3.5 rounded-full bg-red-600 border-2 border-white shadow-md -translate-x-1/2 transition-transform',
              'opacity-0 group-hover/scrub:opacity-100',
              isSeeking && 'opacity-100 scale-125'
            )}
            style={{ left: `${progressFraction}%` }}
          />
        </div>

        {/* Buttons and Time */}
        <div className="flex items-center justify-between gap-2 text-white text-xs sm:text-sm">
          {/* Left group — Item 5: Skip controls only, NO play/pause */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Skip -10s */}
            <button
              type="button"
              onClick={() => skipTime(-10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
              title="Back 10 seconds"
              aria-label="Skip backward 10 seconds"
            >
              <RotateCcw size={18} />
            </button>

            {/* Skip +10s */}
            <button
              type="button"
              onClick={() => skipTime(10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
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
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-brand-primary hidden sm:block"
              />
            </div>

            {/* Time Stamp */}
            <span className="text-[11px] sm:text-xs font-mono font-medium text-white/90 pl-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right group: Fullscreen */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
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
