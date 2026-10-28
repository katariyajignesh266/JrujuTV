// src/components/video/ShortsPlayer.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useShortsStore } from '@/store/shortsStore';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface ShortsPlayerProps {
  videoId: string;
  thumbnailUrl?: string;
  title?: string;
  isActive: boolean;
  onEnded?: () => void;
}

export function ShortsPlayer({
  videoId,
  thumbnailUrl,
  title,
  isActive,
  onEnded,
}: ShortsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const { isMuted, markWatched, toggleLike } = useShortsStore();
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  // Micro-animations state
  const [tapAnimation, setTapAnimation] = useState<'play' | 'pause' | null>(null);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Ensure YouTube IFrame API is loaded once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
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
  }, []);

  // Initialize YouTube player instance
  useEffect(() => {
    let isCancelled = false;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !containerRef.current || isCancelled) return;

      // Clean up previous instance
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      const playerDiv = document.createElement('div');
      playerDiv.className = 'w-full h-full pointer-events-none';
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId,
        playerVars: {
          autoplay: isActiveRef.current ? 1 : 0,
          controls: 0, // Disable native controls
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          enablejsapi: 1,
          loop: 1,
          playlist: videoId,
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            setIsReady(true);

            // Sync initial mute state
            if (isMutedRef.current) {
              event.target.mute();
            } else {
              event.target.unMute();
            }

            if (isActiveRef.current) {
              try {
                event.target.playVideo();
              } catch {
                // In case mobile autoplay blocks unmuted audio
                event.target.mute();
                event.target.playVideo();
              }
            }
          },
          onStateChange: (event: any) => {
            if (isCancelled) return;
            // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setHasStartedPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              onEndedRef.current?.();
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        initPlayer();
      };
    }

    return () => {
      isCancelled = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId]); // Re-create when videoId changes

  // React to isActive changes (scrolling into / out of view)
  useEffect(() => {
    if (!playerRef.current || !isReady) return;

    if (isActive) {
      try {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
        playerRef.current.playVideo();
      } catch {
        // Fallback
      }

      // Mark video as watched after 3 seconds of active viewing
      const timer = setTimeout(() => {
        markWatched(videoId);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      try {
        playerRef.current.pauseVideo();
      } catch {
        // Fallback
      }
    }
  }, [isActive, isReady, isMuted, videoId, markWatched]);

  // Sync mute state dynamically across all shorts
  useEffect(() => {
    if (!playerRef.current || !isReady) return;
    try {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
    } catch {
      // ignore
    }
  }, [isMuted, isReady]);

  // Handle single tap (Play/Pause) vs double tap (Like)
  const handleTouchSurface = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected: Like video!
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      toggleLike(videoId);
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;

    tapTimeoutRef.current = setTimeout(() => {
      // Single tap: toggle Play/Pause
      if (!playerRef.current || !isReady) return;

      if (isPlaying) {
        playerRef.current.pauseVideo();
        setTapAnimation('pause');
      } else {
        playerRef.current.playVideo();
        setTapAnimation('play');
      }

      setTimeout(() => setTapAnimation(null), 500);
    }, DOUBLE_TAP_DELAY);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center">
      {/* 1. Ambient Blurred Backdrop for Full-Coverage Visual Immersion */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-40 pointer-events-none"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
      )}

      {/* 2. YouTube IFrame Player (Strictly pointer-events-none to prevent native YT overlay) */}
      <div className="absolute inset-0 w-full h-full scale-[1.06] origin-center flex items-center justify-center pointer-events-none overflow-hidden">
        <div ref={containerRef} className="w-full h-full pointer-events-none" />
      </div>

      {/* 3. Instant Thumbnail Layer with Smooth Crossfade on First Frame */}
      {thumbnailUrl && (
        <div
          className={cn(
            'absolute inset-0 z-10 transition-opacity duration-300 pointer-events-none flex items-center justify-center',
            hasStartedPlaying ? 'opacity-0' : 'opacity-100'
          )}
        >
          {/* Main crisp thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={title || 'Short thumbnail'}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Buffering Spinner */}
          {!hasStartedPlaying && isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
              <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* 4. Custom Touch/Click Interaction Surface */}
      <div
        onClick={handleTouchSurface}
        className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
        aria-label="Tap to play or pause, double tap to like"
      />

      {/* 5. Sleek Play/Pause Micro-Animation Badge in Center */}
      {tapAnimation && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center animate-scale-fade">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-2xl">
            {tapAnimation === 'play' ? (
              <Play className="w-8 h-8 fill-white ml-1" />
            ) : (
              <Pause className="w-8 h-8 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* 6. Double Tap Heart Burst Animation */}
      {showHeartAnim && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center animate-bounce-heart">
          <div className="w-24 h-24 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center">
            <Heart className="w-16 h-16 text-red-500 fill-red-500 drop-shadow-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
