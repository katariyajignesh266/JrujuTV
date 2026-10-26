'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);
  const muteIndicatorTimer = useRef<NodeJS.Timeout | null>(null);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Ensure YouTube IFrame API is loaded
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

  // Initialize player instance
  useEffect(() => {
    let isCancelled = false;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !containerRef.current || isCancelled) return;

      // Clean up existing player if any
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
        playerRef.current = null;
      }

      const playerDiv = document.createElement('div');
      playerDiv.className = 'w-full h-full';
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId,
        playerVars: {
          autoplay: isActiveRef.current ? 1 : 0,
          controls: 0,
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
          playlist: videoId, // needed for single video loop
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            setIsReady(true);
            if (isActiveRef.current) {
              try {
                event.target.playVideo();
              } catch {
                // browser autoplay policy might require mute
                event.target.mute();
                setIsMuted(true);
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
  }, [videoId]); // Re-create on videoId change

  // React to isActive changes (scrolling into / out of view)
  useEffect(() => {
    if (!playerRef.current || !isReady) return;

    if (isActive) {
      try {
        playerRef.current.playVideo();
      } catch {
        // Fallback if needed
      }
    } else {
      try {
        playerRef.current.pauseVideo();
      } catch {
        // Fallback
      }
    }
  }, [isActive, isReady]);

  // Toggle mute handler (tap sound button)
  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
      setShowMuteIndicator(true);
      if (muteIndicatorTimer.current) clearTimeout(muteIndicatorTimer.current);
      muteIndicatorTimer.current = setTimeout(() => {
        setShowMuteIndicator(false);
      }, 1500);
    } catch {
      // ignore
    }
  }, [isMuted]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {/* 1. Oversized Iframe Player Container (Scale 1.05 to eliminate any YouTube embed watermarks/borders) */}
      <div className="absolute inset-0 w-full h-full scale-[1.04] origin-center flex items-center justify-center pointer-events-none">
        <div ref={containerRef} className="w-full h-full pointer-events-auto" />
      </div>

      {/* 2. Flash-prevention Thumbnail Crossfade Layer */}
      {thumbnailUrl && (
        <div
          className={cn(
            'absolute inset-0 z-10 transition-opacity duration-300 pointer-events-none',
            hasStartedPlaying ? 'opacity-0' : 'opacity-100'
          )}
        >
          {/* Blurred background image for full coverage */}
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-lg scale-110 opacity-60"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
          {/* Main crisp thumbnail */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt={title || 'Short thumbnail'}
              className="w-full h-full object-contain"
            />
          </div>
          {/* Loading spinner while preparing playback */}
          {!hasStartedPlaying && isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* 3. Tap to toggle mute & audio status overlay */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleMute}
          className="p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white/90 border border-white/20 hover:bg-black/80 active:scale-95 transition-all shadow-lg"
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Brief Mute/Unmute Indicator Toast in Center */}
      {showMuteIndicator && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center animate-fade-in">
          <div className="p-4 rounded-full bg-black/75 backdrop-blur-md text-white flex items-center gap-2 border border-white/20 shadow-xl">
            {isMuted ? (
              <>
                <VolumeX className="w-6 h-6 text-red-400" />
                <span className="text-fluid-xs font-semibold">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-6 h-6 text-emerald-400" />
                <span className="text-fluid-xs font-semibold">Sound On</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
