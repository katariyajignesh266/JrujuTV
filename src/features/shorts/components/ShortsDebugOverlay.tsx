// src/features/shorts/components/ShortsDebugOverlay.tsx
'use client';

import React from 'react';
import { V2PoolDebugInfo } from '../hooks/useShortsV2PlayerPool';

interface ShortsDebugOverlayProps {
  debugInfo: V2PoolDebugInfo;
  isV2Enabled: boolean;
  totalLoaded: number;
}

export function ShortsDebugOverlay({
  debugInfo,
  isV2Enabled,
  totalLoaded,
}: ShortsDebugOverlayProps) {
  const { activeSlot, poolSize, slots, lastLatencyMs, spinnerCount, lowMemoryMode } =
    debugInfo;

  return (
    <div className="fixed top-14 right-3 z-50 pointer-events-none select-none font-mono text-[11px] bg-black/80 backdrop-blur-md border border-white/20 text-green-400 p-3 rounded-xl shadow-2xl max-w-xs space-y-1.5">
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <span className="font-bold text-white tracking-wide">⚡ SHORTS V2 DEBUG</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            isV2Enabled ? 'bg-green-600/30 text-green-300' : 'bg-yellow-600/30 text-yellow-300'
          }`}
        >
          {isV2Enabled ? 'NATIVE V2' : 'IFRAME V1'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-neutral-300">
        <span>Active Slot:</span>
        <span className="text-white font-semibold">#{activeSlot}</span>

        <span>Pool Size:</span>
        <span className="text-white">{poolSize} active / 4 max</span>

        <span>First-Frame:</span>
        <span
          className={`font-semibold ${
            lastLatencyMs === null
              ? 'text-neutral-400'
              : lastLatencyMs <= 150
              ? 'text-green-400'
              : 'text-red-400'
          }`}
        >
          {lastLatencyMs !== null ? `${lastLatencyMs} ms` : 'pre-buffered'}
        </span>

        <span>Spinners:</span>
        <span
          className={`font-semibold ${
            spinnerCount === 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {spinnerCount} (target: 0)
        </span>

        <span>Low Mem:</span>
        <span className="text-neutral-300">{lowMemoryMode ? 'Active' : 'Off'}</span>

        <span>Feed Total:</span>
        <span className="text-neutral-300">{totalLoaded} videos</span>
      </div>

      <div className="pt-1 border-t border-white/10">
        <div className="text-[10px] text-neutral-400 mb-0.5">Pool Slots:</div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(slots).map(([slot, state]) => (
            <span
              key={slot}
              className={`px-1 rounded text-[10px] ${
                state === 'PLAYING'
                  ? 'bg-red-500/30 text-red-300 font-bold border border-red-500/50'
                  : state === 'READY'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              #{slot}: {state}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

