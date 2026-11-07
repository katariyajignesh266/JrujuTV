// src/features/shorts/components/ShortsItem.tsx
'use client';

import React, { useRef, useEffect, memo } from 'react';
import { Loader2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ShortVideo } from '../types';
import { useShortsFeatureStore } from '../store/shortsStore';
import { ShortsProgressBar } from './ShortsProgressBar';
import { ShortsVideoPlayer } from './ShortsVideoPlayer';

interface ShortsItemProps {
  video: ShortVideo;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  isMounted: boolean;
  progressPercent: number;
  isV2?: boolean;
  isV2Ready?: boolean;
  isV2Playing?: boolean;
  isV2FirstFrame?: boolean;
  onAttachContainer: (index: number, el: HTMLDivElement | null) => void;
  onAttachV2Container?: (index: number, el: HTMLDivElement | null) => void;
  onGestureTap: () => void;
}

export const ShortsItem = memo(function ShortsItem({
  video,
  index,
  isActive,
  isPlaying,
  isMounted,
  progressPercent,
  isV2 = false,
  isV2Ready = false,
  isV2Playing = false,
  isV2FirstFrame = false,
  onAttachContainer,
  onAttachV2Container,
  onGestureTap,
}: ShortsItemProps) {
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);
  const { hasUserGestureUnlocked } = useShortsFeatureStore();

  // If V1 iframe mode, manage iframe container attachment
  useEffect(() => {
    if (!isV2) {
      if (isMounted) {
        onAttachContainer(index, iframeContainerRef.current);
      } else {
        onAttachContainer(index, null);
      }
      return () => {
        onAttachContainer(index, null);
      };
    }
  }, [index, isV2, isMounted, onAttachContainer]);

  // Determine effective playing & poster visibility state:
  // For V2: remove poster ONLY when the first frame is painted on screen to prevent black flashes!
  // For V1: remove poster when player starts playing.
  const effectivePlaying = isV2 ? isV2FirstFrame : isPlaying;
  const posterUrl = video.poster_url || video.thumbnail_url;
  const isBuffering = isActive && !effectivePlaying;

  return (
    <div className="relative w-full h-full shrink-0 bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Ambient Blurred Backdrop */}
      {posterUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-25 pointer-events-none"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}

      {/* 2. Video Player Layer */}
      {isV2 && onAttachV2Container ? (
        /* V2 Native HTML5 Video Player */
        <ShortsVideoPlayer
          index={index}
          isActive={isActive}
          onAttachContainer={onAttachV2Container}
        />
      ) : (
        /* V1 Scaled YouTube IFrame Player */
        <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
          {isMounted && (
            <div
              ref={iframeContainerRef}
              className="shorts-player-frame pointer-events-none select-none"
            />
          )}
        </div>
      )}

      {/* 3. Poster Layer (Seamless crossfade when video frame is ready — zero black flash) */}
      {posterUrl && (
        <div
          className={cn(
            'absolute inset-0 z-10 transition-opacity duration-300 pointer-events-none flex items-center justify-center bg-black',
            effectivePlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl}
            alt={video.title || 'Shorts'}
            className="w-full h-full object-cover pointer-events-none"
          />

          {/* Buffering indicator: shown while active video is loading / preparing first frame */}
          {isBuffering && (
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
});
