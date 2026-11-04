// src/components/video/VirtualizedVideoGrid.tsx
'use client';

import { useRef, useState, useEffect, useMemo, useContext } from 'react';
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';
import { Video } from '@/types/content';
import { VideoCard } from '@/components/cards/VideoCard';
import { MainScrollContext } from '@/components/layout/MainScrollContext';
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
  const mainScrollRef = useContext(MainScrollContext);
  const [columns, setColumns] = useState(1);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const inFlightRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadMoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep onLoadMore ref in sync
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

  // Measure actual available container width using ResizeObserver to ensure
  // exact columns and eliminate any cut-offs or overflow.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function calcColumnsFromWidth(width: number) {
      setIsDesktopLayout(window.innerWidth >= 768);

      if (window.innerWidth < 768) {
        return 1;
      }

      // Desktop/tablet container width-based responsive column calculation:
      // Minimum comfortable card width is ~260px-280px.
      // Gap is ~16px-20px.
      if (width >= 1700) {
        return 6;
      } else if (width >= 1350) {
        return 5;
      } else if (width >= 1020) {
        return 4;
      } else if (width >= 620) {
        return 3;
      } else if (width >= 400) {
        return 2;
      } else {
        return 1;
      }
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0) {
          const nextCols = calcColumnsFromWidth(cr.width);
          setColumns(nextCols);
        }
      }
    });

    ro.observe(el);

    // Initial check
    const initialWidth = el.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setColumns(calcColumnsFromWidth(initialWidth));
    }

    return () => ro.disconnect();
  }, []);

  // Split flat video list into rows of `columns` items
  const rows = useMemo(() => {
    const r: Video[][] = [];
    for (let i = 0; i < videos.length; i += columns) {
      r.push(videos.slice(i, i + columns));
    }
    return r;
  }, [videos, columns]);

  // Dynamic row height estimation based on column count
  const estimatedRowHeight = useMemo(() => {
    if (columns === 1) return 320;
    if (columns >= 4) return 300;
    return 330;
  }, [columns]);

  // 1. Desktop virtualizer (mounts to <main id="main-content"> scroll container)
  const elementVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => mainScrollRef?.current || document.getElementById('main-content'),
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
  });

  // 2. Mobile virtualizer (mounts to window scroll container, preserving perfect mobile scroll-away header)
  const windowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  const virtualizer = isDesktopLayout ? elementVirtualizer : windowVirtualizer;
  const virtualItems = virtualizer.getVirtualItems();

  const lastRenderedRowIndex =
    virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

  // Virtualizer-aware load-more trigger
  useEffect(() => {
    if (!hasMore || isLoading || inFlightRef.current) return;
    if (lastRenderedRowIndex < 0 || rows.length === 0) return;
    if (!onLoadMoreRef.current) return;

    if (lastRenderedRowIndex >= rows.length - lookAheadOffset - 1) {
      inFlightRef.current = true;

      if (loadMoreTimeoutRef.current) clearTimeout(loadMoreTimeoutRef.current);
      loadMoreTimeoutRef.current = setTimeout(() => {
        inFlightRef.current = false;
      }, 15000);

      try {
        const result = onLoadMoreRef.current();
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
        inFlightRef.current = false;
        if (loadMoreTimeoutRef.current) {
          clearTimeout(loadMoreTimeoutRef.current);
          loadMoreTimeoutRef.current = null;
        }
      }
    }
  }, [lastRenderedRowIndex, rows.length, hasMore, isLoading, lookAheadOffset]);

  const scrollMarginOffset = isDesktopLayout ? 0 : (windowVirtualizer.options.scrollMargin ?? 0);

  return (
    <div
      ref={containerRef}
      className={cn('w-full relative min-w-0 overflow-hidden', className)}
      style={{
        height: `${virtualizer.getTotalSize()}px`,
      }}
    >
      {virtualItems.map((virtualRow) => {
        const rowVideos = rows[virtualRow.index];
        if (!rowVideos) return null;

        const translateY = virtualRow.start - scrollMarginOffset;

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full min-w-0"
            style={{
              transform: `translateY(${Math.max(0, translateY)}px)`,
            }}
          >
            {/* Fluid CSS grid with dynamic inline columns strictly matching rows splitting */}
            <div
              className="md:mx-0 grid gap-0 md:gap-4 lg:gap-5 gap-y-6 pb-6"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowVideos.map((video) => (
                <div key={video.id} className="w-full min-w-0 overflow-hidden">
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
