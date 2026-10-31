// src/features/shorts/components/ShortsContainer.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useShortsFeatureStore } from '../store/shortsStore';
import { useShortsFeedQuery } from '../hooks/useShortsFeedQuery';
import { useShortsPlayerPool } from '../hooks/useShortsPlayerPool';
import { ShortsItem } from './ShortsItem';
import { ShortsEmptyState } from './ShortsEmptyState';

export function ShortsContainer() {
  const { initialized } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const { activeIndex, setActiveIndex } = useShortsFeatureStore();

  const {
    videos,
    loading,
    loadingMore,
    loadMore,
  } = useShortsFeedQuery(initialized);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = scrollContainerRef.current;
      if (!container || index < 0 || index >= videos.length) return;
      const targetTop = index * container.clientHeight;
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    },
    [videos.length]
  );

  const handleNext = useCallback(() => {
    if (activeIndex < videos.length - 1) {
      scrollToIndex(activeIndex + 1);
    }
  }, [activeIndex, videos.length, scrollToIndex]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1);
    }
  }, [activeIndex, scrollToIndex]);

  const {
    attachPlayer,
    playingIndices,
    progressMap,
    handleUserGesturePlayback,
  } = useShortsPlayerPool(videos, handleNext);

  // 1. Primary IntersectionObserver to detect currently visible Short
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || videos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const raw = entry.target.getAttribute('data-index');
            if (raw !== null) {
              const index = parseInt(raw, 10);
              if (!isNaN(index) && index >= 0) {
                setActiveIndex(index);
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[ShortsContainer] Active short changed to index ${index}`);
                }
              }
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.65,
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [videos, setActiveIndex]);

  // 2. Real-time Scroll Synchronizer & Programmatic Snap Fallback
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let snapTimeout: NodeJS.Timeout | null = null;

    const handleScrollSync = () => {
      const h = container.clientHeight;
      if (h <= 0) return;

      const currentTop = container.scrollTop;
      const calculatedIndex = Math.round(currentTop / h);

      if (
        calculatedIndex >= 0 &&
        calculatedIndex < videos.length &&
        calculatedIndex !== activeIndex
      ) {
        setActiveIndex(calculatedIndex);
      }

      // Programmatic snap fallback if CSS snap rests off-center
      if (snapTimeout) clearTimeout(snapTimeout);
      snapTimeout = setTimeout(() => {
        const targetTop = calculatedIndex * h;
        if (Math.abs(container.scrollTop - targetTop) > 2) {
          container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }, 100);
    };

    container.addEventListener('scroll', handleScrollSync, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScrollSync);
      if (snapTimeout) clearTimeout(snapTimeout);
    };
  }, [videos.length, activeIndex, setActiveIndex]);

  // 3. Infinite Feed Sentinel: triggers loadMore before user reaches the bottom
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const sentinelObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: container,
        rootMargin: '600px',
      }
    );

    sentinelObserver.observe(sentinel);
    return () => sentinelObserver.disconnect();
  }, [loadMore]);

  // 4. Desktop keyboard navigation (Arrow Up / Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Viewport calculation filling between mobile header (52px) and bottom nav (58px + safe area)
  const containerHeightStyle = {
    height: 'calc(100dvh - 52px - 58px - env(safe-area-inset-bottom, 0px))',
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        'relative w-full overflow-hidden select-none',
        'md:ml-[72px]',
        sidebarOpen && 'xl:ml-60',
        'transition-all duration-300'
      )}
      style={containerHeightStyle}
    >
      <div className="relative w-full h-full flex items-center justify-center mx-auto overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center w-full h-full space-y-3 bg-black text-white">
            <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
            <p className="text-sm font-medium text-neutral-400">Loading shorts…</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full px-4 bg-black">
            <ShortsEmptyState />
          </div>
        ) : (
          /* Main 9:16 Shorts Container */
          <div className="relative w-full max-w-full md:max-w-[420px] h-full flex items-center justify-center md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-neutral-800 bg-black">
            {/* Vertical Scroll-Snap Track */}
            <div
              ref={scrollContainerRef}
              id="shorts-track"
              className="relative w-full h-full overflow-y-auto bg-black select-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
              style={{
                scrollSnapType: 'y mandatory',
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y',
              }}
            >
              {videos.map((video, index) => {
                const isCurrentActive = index === activeIndex;
                const isNearActive = Math.abs(index - activeIndex) <= 1;
                const isPlaying = !!playingIndices[index];
                const progressPct = progressMap[index] ?? 0;

                return (
                  <div
                    key={`${video.id || video.youtube_video_id}-${index}`}
                    data-index={index}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className="relative w-full shrink-0 bg-black"
                    style={{
                      height: '100%',
                      scrollSnapAlign: 'start',
                      scrollSnapStop: 'always',
                    }}
                  >
                    <ShortsItem
                      video={video}
                      index={index}
                      isActive={isCurrentActive}
                      isPlaying={isPlaying}
                      isMounted={isNearActive}
                      progressPercent={progressPct}
                      onAttachContainer={attachPlayer}
                      onGestureTap={handleUserGesturePlayback}
                    />
                  </div>
                );
              })}

              {/* Infinite Prefetch Sentinel */}
              <div
                ref={sentinelRef}
                className="w-full h-8 shrink-0 flex items-center justify-center bg-black"
              >
                {loadingMore && (
                  <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
                )}
              </div>
            </div>

            {/* Desktop Navigation Floating Controls */}
            <div className="hidden md:flex flex-col gap-3 absolute -right-16 top-1/2 -translate-y-1/2 z-30">
              <button
                type="button"
                onClick={handlePrev}
                disabled={activeIndex === 0}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                title="Previous short (Arrow Up)"
                aria-label="Previous short"
              >
                <ChevronUp size={22} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={activeIndex === videos.length - 1}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                title="Next short (Arrow Down)"
                aria-label="Next short"
              >
                <ChevronDown size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
