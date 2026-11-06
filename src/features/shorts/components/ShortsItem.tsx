// src/features/shorts/components/ShortsItem.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { Loader2, VolumeX } from 'lucide-react';
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
  const { hasUserGestureUnlocked } = useShortsFeatureStore();

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
    <div className="relative w-full h-full shrink-0 bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Ambient Blurred Backdrop */}
      {video.thumbnail_url && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-25 pointer-events-none"
          style={{ backgroundImage: `url(${video.thumbnail_url})` }}
        />
      )}

      {/* 2. Scaled Player Frame (Anti-iframe technique: renders oversized frame & scales down to crop all YouTube UI) */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
        {isMounted && (
          <div
            ref={containerRef}
            className="shorts-player-frame pointer-events-none select-none"
          />
        )}
      </div>

      {/* 3. Poster Layer (Crossfades smoothly as soon as video state reaches PLAYING) */}
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

          {/* Buffering indicator while active short initializes */}
          {isActive && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Full-Bleed Gesture Layer: captures taps to unmute/toggle playback, allows vertical scrolling */}
      <div
        onClick={onGestureTap}
        className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
        aria-label="Tap to unmute or toggle playback"
      />

      {/* 5. Pure Design: Small "⚡ Shorts" Badge Top-Left */}
      <div className="absolute top-[calc(env(safe-area-inset-top,0px)+12px)] left-4 z-30 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white shadow-lg">
        <span className="text-red-500 font-bold text-xs">⚡</span>
        <span className="text-xs font-semibold tracking-wide">Shorts</span>
      </div>

      {/* 6. Sound Status Indicator: shown until first user tap unlocks session sound */}
      {isActive && !hasUserGestureUnlocked && (
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+12px)] right-4 z-30 pointer-events-none animate-pulse">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium shadow-md">
            <VolumeX size={13} className="text-red-400" />
            <span>Tap for sound</span>
          </div>
        </div>
      )}

      {/* 7. Bottom Hairline Progress Bar */}
      <ShortsProgressBar progressPercent={progressPercent} />
    </div>
  );
}
