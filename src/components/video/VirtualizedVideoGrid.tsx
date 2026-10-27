// src/components/video/VirtualizedVideoGrid.tsx
'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Video } from '@/types/content';
import { VideoCard } from '@/components/cards/VideoCard';
import { cn } from '@/lib/cn';

interface VirtualizedVideoGridProps {
  videos: Video[];
  sentinelIndex?: number;
  attachSentinel?: (index: number) => (node: HTMLElement | null) => void;
  className?: string;
}

export function VirtualizedVideoGrid({
  videos,
  sentinelIndex,
  attachSentinel,
  className,
}: VirtualizedVideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

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
    overscan: 2,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

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

        const rowStartIdx = virtualRow.index * columns;
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
              {rowVideos.map((video, colIdx) => {
                const globalIndex = rowStartIdx + colIdx;
                const isSentinel = sentinelIndex !== undefined && globalIndex === sentinelIndex;

                return (
                  <div
                    key={video.id}
                    ref={
                      isSentinel && attachSentinel
                        ? attachSentinel(globalIndex)
                        : undefined
                    }
                    className="w-full"
                  >
                    <VideoCard video={video} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
