// src/features/shorts/components/ShortsDebugOverlay.tsx
'use client';

import React, { useState } from 'react';
import { V2PoolDebugInfo } from '../hooks/useShortsV2PlayerPool';

interface ShortsDebugOverlayProps {
  debugInfo: V2PoolDebugInfo;
  isV2Enabled: boolean;
  activeEngine: string;
  currentMediaStatus: string;
  currentStorageUrl?: string | null;
  currentVideoId?: string;
  totalLoaded: number;
}

export function ShortsDebugOverlay({
  debugInfo,
  activeEngine,
  currentMediaStatus,
  currentStorageUrl,
  currentVideoId,
  totalLoaded,
}: ShortsDebugOverlayProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    activeSlot,
    poolSize,
    slots,
    slotDetails,
    activeDownloads,
    lastLatencyMs,
    timeToCanplayMs,
    timeToFirstFrameMs,
    cdnTimingMs,
    bufferingEvents,
    lowMemoryMode,
    preloadWindow,
    nextPreloadState,
    secondNextPreloadState,
    creationCount,
    cleanupCount,
  } = debugInfo;

  const isV2Active = activeEngine.startsWith('V2');
  const activeDetail = slotDetails[activeSlot];

  return (
    <div className="fixed top-14 right-3 z-50 pointer-events-auto select-none font-mono text-[11px] bg-black/90 backdrop-blur-md border border-white/20 text-green-400 p-3 rounded-xl shadow-2xl max-w-sm space-y-2">
      {/* Header with Engine Badge & Collapse Toggle */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-white tracking-wide">⚡ SHORTS DIAGNOSTICS</span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-neutral-300 hover:text-white"
          >
            {expanded ? 'compact' : 'details'}
          </button>
        </div>
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

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-neutral-300">
        <span>Active Index:</span>
        <span className="text-white font-semibold">#{activeSlot} ({currentVideoId?.slice(0, 8) || 'none'})</span>

        <span>Engine:</span>
        <span className={isV2Active ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
          {isV2Active ? 'V2 HTML5' : 'V1 YouTube'}
        </span>

        <span>Media Status:</span>
        <span
          className={`font-semibold ${
            currentMediaStatus === 'ready' ? 'text-green-400' : 'text-yellow-400'
          }`}
        >
          {currentMediaStatus}
        </span>

        <span>Storage URL:</span>
        <span className={currentStorageUrl ? 'text-green-400' : 'text-neutral-500'}>
          {currentStorageUrl ? 'Available (R2)' : 'null (V1 fallback)'}
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
          {cdnTimingMs !== null ? `${cdnTimingMs} ms` : 'cached / progressive'}
        </span>

        <span>Next (N+1) Preload:</span>
        <span
          className={`font-semibold ${
            nextPreloadState === 'CAN_PLAY' || nextPreloadState === 'READY'
              ? 'text-green-400'
              : nextPreloadState.includes('LOAD')
              ? 'text-blue-400'
              : 'text-neutral-400'
          }`}
        >
          {nextPreloadState}
        </span>

        <span>2nd Next (N+2):</span>
        <span
          className={`font-semibold ${
            secondNextPreloadState === 'CAN_PLAY' || secondNextPreloadState === 'READY'
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

        <span>Active Downloads:</span>
        <span className={activeDownloads > 0 ? 'text-blue-400' : 'text-neutral-400'}>
          {activeDownloads}
        </span>

        <span>Buffering Events:</span>
        <span
          className={`font-semibold ${
            bufferingEvents === 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {bufferingEvents} (target: 0)
        </span>

        <span>Preload Window:</span>
        <span className="text-neutral-300">{preloadWindow}</span>

        <span>Pool Ops:</span>
        <span className="text-neutral-400">+{creationCount} created / -{cleanupCount} pruned</span>

        <span>Low-Memory Mode:</span>
        <span className="text-neutral-300">{lowMemoryMode ? 'Active (≤2GB)' : 'Off (Full)'}</span>

        <span>Feed Total:</span>
        <span className="text-neutral-300">{totalLoaded} videos</span>
      </div>

      {/* Expanded Slot Detail */}
      {expanded && activeDetail && (
        <div className="pt-1.5 border-t border-white/10 text-[10px] space-y-0.5 text-neutral-300">
          <div className="font-semibold text-white">Active Video State:</div>
          <div className="grid grid-cols-2 gap-x-2">
            <span>Ready / Network:</span>
            <span>R={activeDetail.readyState} / N={activeDetail.networkState}</span>
            <span>Attached to DOM:</span>
            <span className={activeDetail.isAttached ? 'text-green-400' : 'text-red-400'}>
              {activeDetail.isAttached ? 'YES' : 'NO'}
            </span>
            <span>Time / Duration:</span>
            <span>{activeDetail.currentTime}s / {activeDetail.duration}s</span>
            {activeDetail.errorMessage && (
              <>
                <span className="text-red-400">Error:</span>
                <span className="text-red-400 truncate">{activeDetail.errorMessage}</span>
              </>
            )}
          </div>
        </div>
      )}

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
                  : state === 'CAN_PLAY' || state === 'READY'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : state === 'ERROR'
                  ? 'bg-red-600/30 text-red-400 border border-red-500/40'
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
