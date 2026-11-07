// src/features/shorts/components/ShortsDebugOverlay.tsx
'use client';

import React from 'react';
import { V2PoolDebugInfo } from '../hooks/useShortsV2PlayerPool';

interface ShortsDebugOverlayProps {
  debugInfo: V2PoolDebugInfo;
  isV2Enabled: boolean;
  activeEngine: 'V2 (Native R2/CDN)' | 'V1 (YouTube IFrame)';
  currentMediaStatus: string;
  totalLoaded: number;
}

export function ShortsDebugOverlay({
  debugInfo,
  isV2Enabled,
  activeEngine,
  currentMediaStatus,
  totalLoaded,
}: ShortsDebugOverlayProps) {
  const {
    activeSlot,
    poolSize,
    slots,
    lastLatencyMs,
    timeToCanplayMs,
    timeToFirstFrameMs,
    cdnTimingMs,
    bufferingEvents,
    lowMemoryMode,
    nextPreloadState,
    secondNextPreloadState,
  } = debugInfo;

  const isV2Active = activeEngine.startsWith('V2');

  return (
    <div className="fixed top-14 right-3 z-50 pointer-events-none select-none font-mono text-[11px] bg-black/85 backdrop-blur-md border border-white/20 text-green-400 p-3 rounded-xl shadow-2xl max-w-xs space-y-1.5">
      {/* Header with Engine Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <span className="font-bold text-white tracking-wide">⚡ SHORTS DIAGNOSTICS</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            isV2Active
              ? 'bg-green-600/30 text-green-300 border border-green-500/40'
              : 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/40'
          }`}
        >
          {activeEngine}
        </span>
      </div>

      {/* Grid of Diagnostics */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-neutral-300">
        <span>Active Index:</span>
        <span className="text-white font-semibold">#{activeSlot}</span>

        <span>Media Status:</span>
        <span
          className={`font-semibold ${
            currentMediaStatus === 'ready' ? 'text-green-400' : 'text-yellow-400'
          }`}
        >
          {currentMediaStatus}
        </span>

        <span>Scroll-to-Frame:</span>
        <span
          className={`font-semibold ${
            lastLatencyMs === null
              ? 'text-neutral-400'
              : lastLatencyMs <= 150
              ? 'text-green-400'
              : 'text-amber-400'
          }`}
        >
          {lastLatencyMs !== null ? `${lastLatencyMs} ms` : 'pre-buffered'}
        </span>

        <span>Time to canplay:</span>
        <span className="text-white">
          {timeToCanplayMs !== null ? `${timeToCanplayMs} ms` : 'n/a'}
        </span>

        <span>Time to 1st Frame:</span>
        <span className="text-white">
          {timeToFirstFrameMs !== null ? `${timeToFirstFrameMs} ms` : 'n/a'}
        </span>

        <span>CDN Download:</span>
        <span className="text-white">
          {cdnTimingMs !== null ? `${cdnTimingMs} ms` : 'cached / range'}
        </span>

        <span>Next (N+1) Preload:</span>
        <span
          className={`font-semibold ${
            nextPreloadState === 'READY'
              ? 'text-green-400'
              : nextPreloadState === 'LOADING'
              ? 'text-blue-400'
              : 'text-neutral-400'
          }`}
        >
          {nextPreloadState}
        </span>

        <span>2nd Next (N+2):</span>
        <span
          className={`font-semibold ${
            secondNextPreloadState === 'READY'
              ? 'text-green-400'
              : secondNextPreloadState.includes('low-mem')
              ? 'text-neutral-500'
              : 'text-neutral-400'
          }`}
        >
          {secondNextPreloadState}
        </span>

        <span>Player Pool:</span>
        <span className="text-white">{poolSize} active / 4 max</span>

        <span>Buffering Events:</span>
        <span
          className={`font-semibold ${
            bufferingEvents === 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {bufferingEvents} (target: 0)
        </span>

        <span>Low-Memory Mode:</span>
        <span className="text-neutral-300">{lowMemoryMode ? 'Active (≤2GB)' : 'Off (Full)'}</span>

        <span>Feed Total:</span>
        <span className="text-neutral-300">{totalLoaded} videos</span>
      </div>

      {/* Pool Slots Visualizer */}
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
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
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
