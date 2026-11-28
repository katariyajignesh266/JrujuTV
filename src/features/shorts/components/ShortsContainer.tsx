// src/features/shorts/components/ShortsContainer.tsx
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { selectActivityVideo } from '@/lib/activity/childActivity';
import { useAuthStore } from '@/store/authStore';
import { useShortsFeatureStore } from '../store/shortsStore';
import { useShortsFeedQuery } from '../hooks/useShortsFeedQuery';
import { useShortsPlayerPool } from '../hooks/useShortsPlayerPool';
import { useShortsV2PlayerPool } from '../hooks/useShortsV2PlayerPool';
import { ShortsItem } from './ShortsItem';
import { ShortsEmptyState } from './ShortsEmptyState';
import { ShortsDebugOverlay } from './ShortsDebugOverlay';
import { ShortVideo } from '../types';
import { ShortsLoading, ShortsStage } from './ShortsStage';
import { ShortsQueue } from './ShortsQueue';
import styles from './Shorts.module.css';

export function ShortsContainer() {
  const { initialized } = useAuthStore();
  const { activeIndex, setActiveIndex, markVideoUnplayable } = useShortsFeatureStore();

  const isV2FeatureFlag = process.env.NEXT_PUBLIC_SHORTS_V2 === 'true';
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [v2FallbackMap, setV2FallbackMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      setIsDebugMode(searchParams.get('debug') === '1');
    }
  }, []);

  const {
    videos,
    loading,
    loadFailed,
    loadingMore,
    loadMore,
    replayShorts,
    refetch,
  } = useShortsFeedQuery(initialized);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isWheelingRef = useRef(false);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = scrollContainerRef.current;
      if (!container || index < 0 || index >= videos.length) return;
      const targetTop = index * container.clientHeight;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const distant = Math.abs(container.scrollTop - targetTop) > container.clientHeight * 1.5;
      container.scrollTo({ top: targetTop, behavior: reduceMotion || distant ? 'instant' : 'smooth' });
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

  // Helper to check if a video item qualifies for V2
  const isVideoV2 = useCallback(
    (video: ShortVideo | undefined, index: number) => {
      if (!isV2FeatureFlag) return false;
      if (v2FallbackMap[index]) return false;
      return !!video?.storage_url && video?.media_status === 'ready';
    },
    [isV2FeatureFlag, v2FallbackMap]
  );

  const handleSkipError = useCallback(
    (index: number) => {
      const vid = videos[index];
      // If error occurs on V2 and YouTube ID is available, fall back to V1 seamlessly!
      if (isVideoV2(vid, index) && vid?.youtube_video_id) {
        console.warn(`[ShortsContainer] V2 playback failed on index ${index}. Switching to V1 YouTube fallback.`);
        setV2FallbackMap((prev) => ({ ...prev, [index]: true }));
        return;
      }

      // Mark unplayable in session store immediately so it never repeats
      if (vid?.id) markVideoUnplayable(vid.id);
      if (vid?.youtube_video_id) markVideoUnplayable(vid.youtube_video_id);

      // If active video fails completely, auto-advance silently to next short within < 500ms
      if (index === activeIndex && activeIndex < videos.length - 1) {
        scrollToIndex(activeIndex + 1);
      }
    },
    [videos, activeIndex, isVideoV2, markVideoUnplayable, scrollToIndex]
  );

  // V1 YouTube IFrame Pool (Fallback)
  const {
    attachPlayer: attachV1Player,
    pauseAllV1Players,
    playingIndices: v1PlayingIndices,
    errorMap: v1ErrorMap,
    progressMap: v1ProgressMap,
    statusMap: v1StatusMap,
    togglePlayback: toggleV1Playback,
    handleUserGesturePlayback: handleV1Gesture,
    retryV1Player,
    getDiagnosticLogs,
  } = useShortsPlayerPool(videos, handleSkipError);

  // V2 Native Video Pool (Instant, Zero-Spinner)
  const {
    attachV2Container,
    pauseAllV2Videos,
    firstFrameMap: v2FirstFrameMap,
    errorMap: v2ErrorMap,
    progressMap: v2ProgressMap,
    statusMap: v2StatusMap,
    togglePlayback: toggleV2Playback,
    handleUserGesturePlayback: handleV2Gesture,
    retryVideo: retryV2Video,
    debugInfo: v2DebugInfo,
  } = useShortsV2PlayerPool(videos, handleSkipError);

  // Determine active item engine
  const currentVideo = videos[activeIndex];
  useEffect(() => {
    if (currentVideo) selectActivityVideo(currentVideo.youtube_video_id || currentVideo.id);
  }, [currentVideo]);
  const isCurrentActiveV2 = isVideoV2(currentVideo, activeIndex);

  // Mutual exclusion: ensure V1 and V2 never play simultaneously
  useEffect(() => {
    if (isCurrentActiveV2) {
      pauseAllV1Players();
    } else {
      pauseAllV2Videos();
    }
  }, [activeIndex, isCurrentActiveV2, pauseAllV1Players, pauseAllV2Videos]);

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
              }
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [videos, setActiveIndex]);

  // 2. Programmatic Snap Center Alignment Fallback (Observer is authoritative for activeIndex)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let snapTimeout: NodeJS.Timeout | null = null;

    const handleScrollSnapCheck = () => {
      const h = container.clientHeight;
      if (h <= 0) return;

      const currentTop = container.scrollTop;
      const targetIndex = Math.round(currentTop / h);

      if (snapTimeout) clearTimeout(snapTimeout);
      snapTimeout = setTimeout(() => {
        const targetTop = targetIndex * h;
        if (Math.abs(container.scrollTop - targetTop) > 2) {
          container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
        if (targetIndex >= 0 && targetIndex < videos.length) {
          setActiveIndex(targetIndex);
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScrollSnapCheck, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScrollSnapCheck);
      if (snapTimeout) clearTimeout(snapTimeout);
    };
  }, [videos.length, setActiveIndex]);

  // 3. Infinite Feed Sentinel: triggers loadMore before user reaches bottom
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

  // 4. Desktop keyboard navigation (Arrow Up / Arrow Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey ||
          (target instanceof HTMLElement && target !== document.body && !target.closest('#main-content'))) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // 5. Desktop mouse wheel debounced navigation
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 30) return;
      if (isWheelingRef.current) {
        e.preventDefault();
        return;
      }

      isWheelingRef.current = true;
      e.preventDefault();

      if (e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }

      setTimeout(() => {
        isWheelingRef.current = false;
      }, 450);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleNext, handlePrev]);

  return (
    <ShortsStage showSound={!loading && !loadFailed && videos.length > 0}>
      {isDebugMode && (
        <ShortsDebugOverlay
          debugInfo={v2DebugInfo}
          isV2Enabled={isV2FeatureFlag}
          activeEngine={isCurrentActiveV2 ? 'V2 (Native R2/CDN)' : 'V1 (YouTube IFrame)'}
          currentMediaStatus={currentVideo?.media_status || 'none'}
          currentStorageUrl={currentVideo?.storage_url || null}
          currentVideoId={currentVideo?.id || currentVideo?.youtube_video_id || ''}
          totalLoaded={videos.length}
          v1DiagnosticLogs={getDiagnosticLogs()}
          v1ErrorMap={v1ErrorMap}
          v2ErrorMap={v2ErrorMap}
        />
      )}
      {loading ? <ShortsLoading /> : loadFailed || !videos.length ? (
        <ShortsEmptyState loadFailed={loadFailed} onRetry={refetch} onReplay={replayShorts} />
      ) : (
        <div className={styles.viewer}>
          <div ref={scrollContainerRef} id="shorts-track" tabIndex={0} role="feed"
            aria-label="Shorts video feed" className={`shorts-container-track ${styles.track}`}>
            {videos.map((video, index) => {
              const isV2 = isVideoV2(video, index);
              const status = isV2 ? v2StatusMap[index] : v1StatusMap[index];
              return (
                <div key={video.id || video.youtube_video_id} data-index={index}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  className={`shorts-snap-card ${styles.snap}`}>
                  <ShortsItem
                    video={video}
                    index={index}
                    isActive={index === activeIndex}
                    isMounted={index >= activeIndex - 1 && index <= activeIndex + 2}
                    isV2={isV2}
                    hasFrame={isV2 ? !!v2FirstFrameMap[index] : !!v1PlayingIndices[index]}
                    isPlaying={status === 'PLAYING'}
                    progressPercent={(isV2 ? v2ProgressMap : v1ProgressMap)[index] ?? 0}
                    errorMessage={(isV2 ? v2ErrorMap : v1ErrorMap)[index] ?? null}
                    onAttachContainer={attachV1Player}
                    onAttachV2Container={attachV2Container}
                    onGestureTap={isV2 ? handleV2Gesture : handleV1Gesture}
                    onTogglePlayback={isV2 ? toggleV2Playback : toggleV1Playback}
                    onRetry={() => isV2 ? retryV2Video(index) : retryV1Player(index)}
                  />
                </div>
              );
            })}
            <div ref={sentinelRef} className={styles.sentinel}>
              {loadingMore && <LoaderCircle size={16} aria-label="Loading more shorts" />}
            </div>
          </div>
          <ShortsQueue videos={videos} activeIndex={activeIndex} onSelect={scrollToIndex} />
        </div>
      )}
    </ShortsStage>
  );
}
