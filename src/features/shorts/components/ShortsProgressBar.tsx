// src/features/shorts/components/ShortsProgressBar.tsx
'use client';

import React from 'react';

interface ShortsProgressBarProps {
  progressPercent: number;
}

export function ShortsProgressBar({ progressPercent }: ShortsProgressBarProps) {
  const boundedPct = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 h-[2.5px] bg-white/20 pointer-events-none">
      <div
        className="h-full bg-brand-primary transition-all duration-300 ease-linear shadow-[0_0_8px_rgba(229,57,53,0.8)]"
        style={{ width: `${boundedPct}%` }}
      />
    </div>
  );
}

