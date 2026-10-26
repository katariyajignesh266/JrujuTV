'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
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

export function YouTubePlayer({
  videoId,
  title,
  autoplay = true,
  onEnded,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isApiReady, setIsApiReady] = useState(false);

  // Auto-hide controls timer
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);

    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3200);
  }, []);

  const handleMouseMove = () => {
    scheduleHideControls();
  };

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
      },
      events: {
        onReady: (event: any) => {
          if (!isMounted) return;
          playerRef.current = event.target;
          const dur = event.target.getDuration();
          if (dur) setDuration(dur);
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
          } else if (event.data === 3) {
            setIsBuffering(true);
          } else if (event.data === 0) {
            setIsPlaying(false);
            setIsBuffering(false);
            setShowControls(true);
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
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [isApiReady, videoId, autoplay, onEnded, scheduleHideControls]);

  // Polling current playback time
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === 'number') setCurrentTime(time);
        const dur = playerRef.current.getDuration();
        if (typeof dur === 'number' && dur > 0) setDuration(dur);
      }
    }, 400);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Controls Handlers
  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(targetTime, true);
    }
  };

  const skipTime = (delta: number) => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    setCurrentTime(newTime);
    playerRef.current.seekTo(newTime, true);
    scheduleHideControls();
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

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={scheduleHideControls}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative w-full aspect-video bg-black overflow-hidden select-none group',
        isFullscreen ? 'fixed inset-0 z-[500] aspect-auto h-screen w-screen' : 'rounded-3xl border border-border/40 shadow-2xl'
      )}
    >
      {/* ── 1. The Underlying YouTube IFrame ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div id={`yt-player-${videoId}`} className="w-full h-full" />
      </div>

      {/* ── 2. Click Intercept Overlay (Blocks all external YT redirects) ── */}
      <button
        type="button"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        onClick={togglePlay}
        className="absolute inset-0 z-10 w-full h-full cursor-pointer bg-transparent focus:outline-none"
      />

      {/* ── 3. Buffering / Loading Spinner ── */}
      {isBuffering && (
        <div className="absolute inset-0 z-15 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <Loader2 className="h-12 w-12 text-brand-primary animate-spin" />
        </div>
      )}

      {/* ── 4. Center Play/Pause indicator on click ── */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 z-15 pointer-events-none flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl animate-in zoom-in-75 duration-150">
            <Play size={28} className="translate-x-0.5 fill-white" />
          </div>
        </div>
      )}

      {/* ── 5. Custom Control Bar ── */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 pointer-events-auto',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Progress / Seek Bar */}
        <div className="relative flex items-center group/scrub mb-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 sm:h-2 bg-white/25 rounded-lg appearance-none cursor-pointer accent-brand-primary focus:outline-none"
          />
        </div>

        {/* Buttons and Time */}
        <div className="flex items-center justify-between gap-2 text-white text-xs sm:text-sm">
          {/* Left group */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white"
              title={isPlaying ? 'Pause (k)' : 'Play (k)'}
            >
              {isPlaying ? <Pause size={20} className="fill-white" /> : <Play size={20} className="fill-white" />}
            </button>

            {/* Skip -10s */}
            <button
              type="button"
              onClick={() => skipTime(-10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
              title="Back 10 seconds"
            >
              <RotateCcw size={18} />
            </button>

            {/* Skip +10s */}
            <button
              type="button"
              onClick={() => skipTime(10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
              title="Forward 10 seconds"
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
            >
              {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
