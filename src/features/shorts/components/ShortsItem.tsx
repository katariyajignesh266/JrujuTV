// src/features/shorts/components/ShortsItem.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ShortVideo } from '../types';
import { useShortsFeatureStore } from '../store/shortsStore';
import { ShortsProgressBar } from './ShortsProgressBar';

interface ShortsItemProps {
  video: ShortVideo;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  isMounted: boolean;
  progressPercent: number;
  onAttachContainer: (index: number, el: HTMLDivElement | null) => void;
  onGestureTap: () => void;
}

export function ShortsItem({
  video,
  index,
  isActive,
  isPlaying,
  isMounted,
  progressPercent,
  onAttachContainer,
  onGestureTap,
}: ShortsItemProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { isMuted } = useShortsFeatureStore();

  // Attach container to player pool only when in active window
  useEffect(() => {
    if (isMounted) {
      onAttachContainer(index, containerRef.current);
    } else {
      onAttachContainer(index, null);
    }
    return () => {
      onAttachContainer(index, null);
    };
  }, [index, isMounted, onAttachContainer]);

  return (
    <div
      className="relative w-full h-full shrink-0 bg-black flex flex-col justify-between overflow-hidden select-none"
    >
      {/* 1. Ambient Blurred Backdrop */}
      {video.thumbnail_url && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-30 pointer-events-none"
          style={{ backgroundImage: `url(${video.thumbnail_url})` }}
        />
      )}

      {/* 2. Scaled Player Frame (scale-[1.15] crops YouTube UI & letterboxing) */}
      <div className="absolute inset-0 w-full h-full scale-[1.15] origin-center flex items-center justify-center pointer-events-none overflow-hidden">
        {isMounted && (
          <div ref={containerRef} className="w-full h-full pointer-events-none" />
        )}
      </div>

      {/* 3. Poster Layer (Crossfades smoothly when video reaches PLAYING state) */}
      {video.thumbnail_url && (
        <div
          className={cn(
            'absolute inset-0 z-10 transition-opacity duration-300 pointer-events-none flex items-center justify-center bg-black',
            isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail_url}
            alt={video.title || 'Shorts'}
            className="w-full h-full object-cover pointer-events-none"
          />

          {/* Buffering or Tap-to-play indicator while active video prepares */}
          {isActive && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Full-Bleed Gesture Layer (captures tap for mute/play toggle, allows vertical scroll) */}
      <div
        onClick={onGestureTap}
        className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
        aria-label="Tap to toggle audio"
      />

      {/* 5. Pure Design: Small "Shorts" Badge Top-Left */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white shadow-lg">
        <span className="text-red-500 font-bold text-xs">⚡</span>
        <span className="text-xs font-semibold tracking-wide">Shorts</span>
      </div>

      {/* 6. Muted Autoplay Indicator (Fades out when unmuted) */}
      {isActive && isMuted && (
        <div className="absolute top-4 right-4 z-30 pointer-events-none animate-fade-in">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-medium shadow-md">
            <span>Tap to unmute 🔇</span>
          </div>
        </div>
      )}

      {/* 7. Bottom Hairline Progress Bar */}
      <ShortsProgressBar progressPercent={progressPercent} />
    </div>
  );
}
