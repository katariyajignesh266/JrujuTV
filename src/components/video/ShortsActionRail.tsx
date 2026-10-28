// src/components/video/ShortsActionRail.tsx
'use client';

import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useShortsStore } from '@/store/shortsStore';
import { formatViewCount } from '@/lib/formatters';

interface ShortsActionRailProps {
  videoId: string;
  title?: string;
  channelName?: string;
  channelAvatarUrl?: string;
  likeCount?: number;
  commentCount?: number;
  className?: string;
}

export function ShortsActionRail({
  videoId,
  title,
  channelName,
  channelAvatarUrl,
  likeCount = 1420,
  commentCount = 48,
  className,
}: ShortsActionRailProps) {
  const { isLiked, toggleLike, isMuted, toggleMute, openComments } = useShortsStore();
  const liked = isLiked(videoId);

  const [copied, setCopied] = useState(false);
  const [likePulse, setLikePulse] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(videoId);
    setLikePulse(true);
    setTimeout(() => setLikePulse(false), 400);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: title || 'Watch this short on JruJu TV',
          text: `Check out "${title || 'this short'}" on JruJu TV!`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }

    // Fallback: copy to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    openComments(videoId);
  };

  const handleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMute();
  };

  const currentLikes = liked ? likeCount + 1 : likeCount;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 text-white z-30 select-none pointer-events-auto',
        className
      )}
    >
      {/* 1. Like Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleLike}
          aria-label={liked ? 'Unlike short' : 'Like short'}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
            'bg-black/45 backdrop-blur-md border border-white/15 hover:bg-black/60 active:scale-90',
            likePulse && 'scale-125'
          )}
        >
          <Heart
            className={cn(
              'w-6 h-6 transition-colors',
              liked ? 'text-red-500 fill-red-500 stroke-red-500' : 'text-white'
            )}
          />
        </button>
        <span className="text-[11px] font-semibold tracking-tight drop-shadow-md text-white/95">
          {formatViewCount(currentLikes)}
        </span>
      </div>

      {/* 2. Comments Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleOpenComments}
          aria-label="View comments"
          className="w-12 h-12 rounded-full flex items-center justify-center bg-black/45 backdrop-blur-md border border-white/15 hover:bg-black/60 active:scale-90 transition-all duration-200 text-white"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
        <span className="text-[11px] font-semibold tracking-tight drop-shadow-md text-white/95">
          {commentCount}
        </span>
      </div>

      {/* 3. Share Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share short"
          className="relative w-12 h-12 rounded-full flex items-center justify-center bg-black/45 backdrop-blur-md border border-white/15 hover:bg-black/60 active:scale-90 transition-all duration-200 text-white"
        >
          {copied ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : (
            <Share2 className="w-5 h-5" />
          )}
        </button>
        <span className="text-[11px] font-semibold tracking-tight drop-shadow-md text-white/95">
          {copied ? 'Copied' : 'Share'}
        </span>
      </div>

      {/* 4. Audio Mute / Unmute Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleSound}
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-black/45 backdrop-blur-md border border-white/15 hover:bg-black/60 active:scale-90 transition-all duration-200 text-white"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-emerald-400" />
          )}
        </button>
        <span className="text-[10px] font-medium tracking-tight drop-shadow-md text-white/80">
          {isMuted ? 'Muted' : 'Sound'}
        </span>
      </div>
    </div>
  );
}
