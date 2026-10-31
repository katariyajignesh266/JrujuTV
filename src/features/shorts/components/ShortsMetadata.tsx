// src/features/shorts/components/ShortsMetadata.tsx
'use client';

import React from 'react';
import { ShortVideo } from '../types';

interface ShortsMetadataProps {
  video: ShortVideo;
}

export function ShortsMetadata({ video }: ShortsMetadataProps) {
  const channelTitle = video.channelName || video.channel?.title || 'Creator';
  const avatarUrl = video.channelAvatarUrl || video.channel?.thumbnail_url;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-6 pr-16 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none text-white space-y-1.5 select-none">
      {/* Channel Identity */}
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full overflow-hidden bg-white/20 border border-white/30 shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={channelTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-xs text-white">
              {channelTitle.charAt(0)}
            </div>
          )}
        </div>
        <span className="font-bold text-fluid-sm drop-shadow-md truncate text-white">
          {channelTitle}
        </span>
      </div>

      {/* Video Title (One-line truncation with subtle drop-shadow) */}
      <p className="font-medium text-fluid-sm text-white/95 truncate drop-shadow-md leading-snug">
        {video.title}
      </p>
    </div>
  );
}

