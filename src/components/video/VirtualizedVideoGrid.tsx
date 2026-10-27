// src/components/video/VirtualizedVideoGrid.tsx
'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Video } from '@/types/content';
import { VideoCard } from '@/components/cards/VideoCard';
import { cn } from '@/lib/cn';

interface VirtualizedVideoGridProps {
  videos: Video[];
  /** Callback to load the next page of results */
  onLoadMore?: () => void | Promise<void>;
  /** Whether more pages are available */
  hasMore?: boolean;
  /** Whether a fetch is currently in progress */
  isLoading?: boolean;
  /** How many rows from the end should trigger the look-ahead fetch (default: 2) */
  lookAheadOffset?: number;
  className?: string;
}

export function VirtualizedVideoGrid({
  videos,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  lookAheadOffset = 2,
  className,
}: VirtualizedVideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const inFlightRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadMoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep onLoadMore ref in sync to avoid stale closures in the trigger effect
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // Reset inFlight guard when loading completes
  useEffect(() => {
    if (!isLoading) {
      inFlightRef.current = false;
    }
  }, [isLoading]);

  // Cleanup safety timeout on unmount
  useEffect(() => {
    return () => {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, []);

  // Responsive column calculation matching Tailwind breakpoints:
  // sm: 640px (2 cols), lg: 1024px (3 cols), xl: 1280px (4 cols), 2xl: 1536px (5 cols)
  useEffect(() => {
    function updateColumns() {
      const width = window.innerWidth;
      if (width >= 1536) {
        setColumns(5);
      } else if (width >= 1280) {
        setColumns(4);
      } else if (width >= 1024) {
        setColumns(3);
      } else if (width >= 640) {
        setColumns(2);
      } else {
        setColumns(1);
      }
    }

    updateColumns();
    window.addEventListener('resize', updateColumns, { passive: true });
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Split flat video list into rows of `columns` items
  const rows = useMemo(() => {
    const r: Video[][] = [];
    for (let i = 0; i < videos.length; i += columns) {
      r.push(videos.slice(i, i + columns));
    }
    return r;
  }, [videos, columns]);

  // Estimate row height based on columns / device aspect ratio
  // Mobile single column: aspect-video (~210px) + info (~80px) + gap-y (~24px) ≈ 320px
  // Desktop multi column: card height ≈ 340px
  const estimatedRowHeight = useMemo(() => {
    return columns === 1 ? 320 : 340;
  }, [columns]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Derive the last rendered row index as a stable primitive for the effect dependency.
  // This avoids re-running the effect on every virtualItems array reference change.
  const lastRenderedRowIndex =
    virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

  // ── Virtualizer-aware load-more trigger ──────────────────────────────────────
  // Instead of observing a DOM sentinel element (which virtualization may unmount),
  // we check whether the last rendered virtual row is within `lookAheadOffset`
  // rows of the total row count. This is a pure state/index check that works
  // reliably regardless of which DOM nodes are currently mounted.
  useEffect(() => {
    if (!hasMore || isLoading || inFlightRef.current) return;
    if (lastRenderedRowIndex < 0 || rows.length === 0) return;
    if (!onLoadMoreRef.current) return;

    if (lastRenderedRowIndex >= rows.length - lookAheadOffset - 1) {
      inFlightRef.current = true;

      // Safety timeout: if the fetch hasn't completed in 15 seconds, force-reset
      // the guard so the user isn't permanently stuck (Fix 4.2)
      if (loadMoreTimeoutRef.current) clearTimeout(loadMoreTimeoutRef.current);
      loadMoreTimeoutRef.current = setTimeout(() => {
        inFlightRef.current = false;
      }, 15000);

      try {
        const result = onLoadMoreRef.current();
        // Handle async onLoadMore: reset guard on completion
        if (result && typeof result.then === 'function') {
          result.catch(() => {}).finally(() => {
            inFlightRef.current = false;
            if (loadMoreTimeoutRef.current) {
              clearTimeout(loadMoreTimeoutRef.current);
              loadMoreTimeoutRef.current = null;
            }
          });
        }
      } catch {
        // Synchronous throw: reset guard immediately
        inFlightRef.current = false;
        if (loadMoreTimeoutRef.current) {
          clearTimeout(loadMoreTimeoutRef.current);
          loadMoreTimeoutRef.current = null;
        }
      }
    }
  }, [lastRenderedRowIndex, rows.length, hasMore, isLoading, lookAheadOffset]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full relative', className)}
      style={{
        height: `${virtualizer.getTotalSize()}px`,
      }}
    >
      {virtualItems.map((virtualRow) => {
        const rowVideos = rows[virtualRow.index];
        if (!rowVideos) return null;

        const translateY = virtualRow.start - virtualizer.options.scrollMargin;

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(${Math.max(0, translateY)}px)`,
            }}
          >
            {/* Grid container preserving existing edge-to-edge mobile & spacing */}
            <div className="-mx-3 sm:-mx-4 md:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0 sm:gap-4 gap-y-6 pb-6">
              {rowVideos.map((video) => (
                <div key={video.id} className="w-full">
                  <VideoCard video={video} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
