// src/hooks/useLookAheadPagination.ts
import { useEffect, useRef, useCallback } from 'react';

interface UseLookAheadPaginationOptions {
  /** Total number of currently rendered items */
  itemCount: number;
  /** Whether more items are available on the backend */
  hasMore: boolean;
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** How many items from the end should trigger the look-ahead fetch (default: 4) */
  lookAheadOffset?: number;
  /** Root margin for the IntersectionObserver (default: '600px 0px') */
  rootMargin?: string;
  /** Callback fired to fetch the next batch */
  onLoadMore: () => void | Promise<void>;
}

export function useLookAheadPagination({
  itemCount,
  hasMore,
  isLoading,
  lookAheadOffset = 4,
  rootMargin = '600px 0px',
  onLoadMore,
}: UseLookAheadPaginationOptions) {
  const sentinelElementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const inFlightRef = useRef(false);

  // Keep options synced in refs to avoid observer teardown on every render
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    if (!isLoading) {
      inFlightRef.current = false;
    }
  }, [isLoading]);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // Determine the target 0-indexed sentinel position (e.g. 4th from last)
  const sentinelIndex = Math.max(0, itemCount - lookAheadOffset);

  // Setup observer on the current sentinel element
  useEffect(() => {
    const el = sentinelElementRef.current;
    if (!el) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          hasMoreRef.current &&
          !isLoadingRef.current &&
          !inFlightRef.current
        ) {
          inFlightRef.current = true;
          onLoadMoreRef.current();
        }
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(el);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [itemCount, rootMargin]);

  // Callback ref to attach to the sentinel item
  const attachSentinel = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      if (index === sentinelIndex) {
        sentinelElementRef.current = node;
      }
    },
    [sentinelIndex]
  );

  return {
    sentinelIndex,
    attachSentinel,
  };
}
