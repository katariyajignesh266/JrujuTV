// src/features/shorts/components/ShortsVideoPlayer.tsx
'use client';

import React, { useRef, useEffect, memo } from 'react';

interface ShortsVideoPlayerProps {
  index: number;
  isActive: boolean;
  onAttachContainer: (index: number, el: HTMLDivElement | null) => void;
}

export const ShortsVideoPlayer = memo(function ShortsVideoPlayer({
  index,
  isActive,
  onAttachContainer,
}: ShortsVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onAttachContainer(index, containerRef.current);
    return () => {
      onAttachContainer(index, null);
    };
  }, [index, onAttachContainer]);

  return (
    <div
      ref={containerRef}
      data-v2-slot={index}
      data-active={isActive ? 'true' : 'false'}
      className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden select-none bg-black"
    />
  );
});
