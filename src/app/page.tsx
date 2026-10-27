'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { VideoCardSkeleton } from '@/components/cards/VideoCard';
import { VirtualizedVideoGrid } from '@/components/video/VirtualizedVideoGrid';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tv2, Plus, Loader2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Video } from '@/types/content';
import { cn } from '@/lib/cn';


export default function HomePage() {
  const { role, initialized } = useAuthStore();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [allChannelsSynced, setAllChannelsSynced] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Session-stable shuffle seed: persistent within the browser session, fresh on new tab/session
  const [seed, setSeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('jruju_feed_seed');
      if (stored) return parseInt(stored, 10);
      const generated = Math.floor(Math.random() * 1000000);
      sessionStorage.setItem('jruju_feed_seed', generated.toString());
      return generated;
    }
    return 42;
  });

  const nextCursorRef = useRef<string | null>(null);
  const pageRef = useRef(1);
  const seedRef = useRef(seed);

  const fetchFeed = useCallback(
    async (
      pageNum: number = 1,
      append: boolean = false,
      currentSeed: number = seedRef.current,
      cursor: string | null = null
    ) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        let url = `/api/feed/home?page=${pageNum}&pageSize=20&seed=${currentSeed}`;
        if (cursor) {
          url += `&cursor=${encodeURIComponent(cursor)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.videos) {
          if (append) {
            setVideos((prev) => {
              // Deduplicate any video already in state by id
              const existingIds = new Set(prev.map((v) => v.id));
              const newItems = data.videos.filter((v: Video) => !existingIds.has(v.id));
              return [...prev, ...newItems];
            });
          } else {
            setVideos(data.videos);
          }

          setHasMore(Boolean(data.hasMore));
          setAllChannelsSynced(data.allChannelsSynced !== false); // default true for legacy responses
          nextCursorRef.current = data.nextCursor || null;
          setPage(pageNum);
          pageRef.current = pageNum;
          setFetchError(null);
        }
      } catch (err: any) {
        console.error('Failed to load home feed:', err);
        setFetchError(err?.message || 'Failed to load videos. Tap to retry.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    if (initialized) {
      nextCursorRef.current = null;
      fetchFeed(1, false, seed, null);
    }
  }, [initialized, seed, fetchFeed]);

  // Pagination callback — triggered by VirtualizedVideoGrid's built-in
  // scroll-position-aware detection when the user approaches the end of loaded content
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setFetchError(null);
    const nextPage = pageRef.current + 1;
    fetchFeed(nextPage, true, seedRef.current, nextCursorRef.current);
  }, [loadingMore, hasMore, fetchFeed]);

  const handleRefresh = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('jruju_feed_seed', newSeed.toString());
    }
    setSeed(newSeed);
  };

  // Filter by category chip with smart stem matching (e.g. Stories -> Story, Bhajans -> Bhajan)
  const filteredVideos =
    activeCategory === 'All'
      ? videos
      : videos.filter((v) => {
          const lowerCat = activeCategory.toLowerCase();
          const stem = lowerCat.endsWith('ies')
            ? lowerCat.slice(0, -3) + 'y'
            : lowerCat.endsWith('s')
            ? lowerCat.slice(0, -1)
            : lowerCat;
          const title = v.title.toLowerCase();
          const ch = (v.channelName || '').toLowerCase();
          return (
            title.includes(lowerCat) ||
            title.includes(stem) ||
            ch.includes(lowerCat) ||
            ch.includes(stem)
          );
        });

  return (
    <PageShell>
      <div className="space-y-4 pb-16">
        {/* Category chip bar with Refresh shuffle button */}
        <div className="flex items-center justify-between gap-3">
          <CategoryChips activeCategory={activeCategory} onSelect={setActiveCategory} />
          {videos.length > 0 && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="shrink-0 p-2 rounded-full text-content-secondary hover:text-brand-primary hover:bg-surface-secondary transition-colors"
              title="Shuffle feed"
            >
              <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
            </button>
          )}
        </div>

        {/* Video Card Grid — Virtualized with look-ahead pagination */}
        <section aria-label="Videos feed" className="mt-2">
          {loading ? (
            <div className="-mx-3 sm:-mx-4 md:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0 sm:gap-4 gap-y-6">
              <VideoCardSkeleton count={12} />
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50dvh]">
              <div className="max-w-md w-full text-center space-y-4">
                <EmptyState
                  icon={Tv2}
                  title={role === 'parent' ? 'No Videos in Your Feed' : 'Your Feed is Empty'}
                  description={
                    role === 'parent'
                      ? 'Add YouTube channels in Admin Controls to curate safe, educational, and fun content for your kids.'
                      : 'Ask your parents to add YouTube channels in their Parent account to watch safe videos here!'
                  }
                />
                {role === 'parent' && (
                  <div className="pt-2">
                    <Link
                      href="/settings/manage-channels"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-95 transition-all"
                    >
                      <Plus size={16} />
                      <span>Manage &amp; Add Channels</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <VirtualizedVideoGrid
              videos={filteredVideos}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              isLoading={loadingMore}
            />
          )}

          {/* Continuous look-ahead pre-load indicator */}
          {loadingMore && (
            <div className="pt-6 pb-4 flex justify-center">
              <div className="flex items-center gap-2 text-content-secondary">
                <Loader2 size={16} className="animate-spin text-brand-primary" />
                <span className="text-fluid-sm">Loading more videos…</span>
              </div>
            </div>
          )}

          {/* Fetch error with retry (Fix 4.4) */}
          {fetchError && !loading && !loadingMore && (
            <div className="pt-6 pb-4 flex flex-col items-center gap-3">
              <p className="text-fluid-sm text-red-500 dark:text-red-400 font-medium">
                {fetchError}
              </p>
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Manual load-more fallback — visible when auto-pagination hasn't triggered (Fix 4.4) */}
          {hasMore && !loadingMore && !loading && !fetchError && (
            <div className="pt-4 pb-2 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-surface-secondary border border-border text-content-secondary hover:border-brand-primary/50 hover:text-brand-primary active:scale-95 transition-all"
              >
                <span>Load More Videos</span>
              </button>
            </div>
          )}

          {/* THREE-STATE END MESSAGES */}

          {/* State 1: Importing — some channels haven't finished ingestion */}
          {!hasMore && !loading && videos.length > 0 && !allChannelsSynced && (
            <div className="pt-6 pb-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Loader2 size={14} className="animate-spin" />
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Still importing videos — more will appear as channels finish syncing
                </p>
              </div>
            </div>
          )}

          {/* State 2: Genuine end — all channels fully synced AND no more DB rows */}
          {!hasMore && !loading && videos.length > 0 && allChannelsSynced && (
            <div className="pt-6 pb-4 flex justify-center">
              <p className="text-xs text-content-secondary">You&apos;ve reached the end of your feed</p>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function CategoryChips({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  const categories = ['All', 'Bhajans', 'Stories', 'Education', 'Cartoons', 'Nature', 'Festivals', 'Yoga'];

  return (
    <nav aria-label="Content categories" className="relative flex-1 min-w-0">
      <ul
        role="list"
        className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map((cat) => {
          const isSelected = activeCategory === cat;
          return (
            <li key={cat} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(cat)}
                className={cn(
                  'px-3.5 py-1 rounded-full text-[11.5px] font-medium transition-all duration-200 whitespace-nowrap',
                  'focus-visible:ring-2 focus-visible:ring-brand-primary',
                  isSelected
                    ? 'bg-content-primary text-surface-primary shadow-sm font-semibold'
                    : 'bg-neutral-900/5 dark:bg-white/5 border border-neutral-900/10 dark:border-white/10 text-content-secondary hover:bg-neutral-900/10 dark:hover:bg-white/10 hover:text-content-primary'
                )}
                aria-pressed={isSelected}
              >
                {cat}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
