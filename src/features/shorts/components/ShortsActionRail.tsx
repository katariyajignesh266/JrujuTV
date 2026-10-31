// src/features/shorts/components/ShortsActionRail.tsx
'use client';

import React, { useState } from 'react';
import { ThumbsUp, MessageCircle, Bookmark, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useShortsFeatureStore } from '../store/shortsStore';
import { toggleShortLike, toggleShortSave } from '../api/shortsApi';
import { ShortVideo } from '../types';
import { formatCompactNumber } from '@/lib/formatters';

interface ShortsActionRailProps {
  video: ShortVideo;
  className?: string;
}

export function ShortsActionRail({ video, className }: ShortsActionRailProps) {
  const {
    isMuted,
    toggleMute,
    openComments,
    likedMap,
    likeCountMap,
    savedMap,
    setOptimisticLike,
    setOptimisticSave,
  } = useShortsFeatureStore();

  const isLiked = likedMap[video.id] ?? video.is_liked;
  const likeCount = likeCountMap[video.id] ?? video.family_like_count ?? 0;
  const isSaved = savedMap[video.id] ?? video.is_saved;

  const [likePulse, setLikePulse] = useState(false);
  const [savePulse, setSavePulse] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLiked = !isLiked;
    const delta = nextLiked ? 1 : -1;
    setOptimisticLike(video.id, nextLiked, delta);
    setLikePulse(true);
    setTimeout(() => setLikePulse(false), 300);

    try {
      await toggleShortLike(video.id);
    } catch {
      // Revert on error
      setOptimisticLike(video.id, !nextLiked, -delta);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSaved = !isSaved;
    setOptimisticSave(video.id, nextSaved);
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 300);

    try {
      await toggleShortSave(video.id);
    } catch {
      setOptimisticSave(video.id, !nextSaved);
    }
  };

  const handleOpenComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    openComments(video);
  };

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMute();
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3.5 text-white z-30 select-none pointer-events-auto',
        className
      )}
    >
      {/* 1. Like Button (Thumbs Up) */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleLike}
          aria-label={isLiked ? 'Unlike short' : 'Like short'}
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
            'bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 active:scale-90',
            likePulse && 'scale-125'
          )}
        >
          <ThumbsUp
            className={cn(
              'w-5 h-5 transition-colors',
              isLiked ? 'text-red-500 fill-red-500 stroke-red-500' : 'text-white'
            )}
          />
        </button>
        <span className="text-[11px] font-semibold tracking-tight drop-shadow-md text-white/95">
          {formatCompactNumber(likeCount)}
        </span>
      </div>

      {/* 2. Family Comments Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleOpenComments}
          aria-label="View family comments"
          className="w-11 h-11 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 active:scale-90 transition-all text-white"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        <span className="text-[11px] font-semibold tracking-tight drop-shadow-md text-white/95">
          {video.family_comment_count ?? 0}
        </span>
      </div>

      {/* 3. Save / Favorite Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleSave}
          aria-label={isSaved ? 'Remove from saved' : 'Save short'}
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
            'bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 active:scale-90',
            savePulse && 'scale-125'
          )}
        >
          <Bookmark
            className={cn(
              'w-5 h-5 transition-colors',
              isSaved ? 'text-amber-400 fill-amber-400 stroke-amber-400' : 'text-white'
            )}
          />
        </button>
        <span className="text-[11px] font-semibold tracking-tight drop-shadow-md text-white/95">
          {isSaved ? 'Saved' : 'Save'}
        </span>
      </div>

      {/* 4. Sound Mute / Unmute Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleToggleSound}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 active:scale-90 transition-all text-white"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-emerald-400" />
          )}
        </button>
        <span className="text-[10px] font-medium tracking-tight drop-shadow-md text-white/85">
          {isMuted ? 'Muted' : 'Sound'}
        </span>
      </div>
    </div>
  );
}

