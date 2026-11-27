'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { VideoCard, VideoCardSkeleton } from '@/components/cards/VideoCard';
import { VirtualizedVideoGrid } from '@/components/video/VirtualizedVideoGrid';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tv2, Plus, Loader2, RefreshCw, Shuffle, Sparkles, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Video } from '@/types/content';
import { cn } from '@/lib/cn';

export default function HomePage() {
  const { role, initialized } = useAuthStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');
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
        if (!res.ok) {
          throw new Error(`Feed request failed (${res.status})`);
        }
        const data = await res.json();

        if (data.videos) {
          if (append) {
            setVideos((prev) => {
              const existingIds = new Set(prev.map((v) => v.id));
              const newItems = data.videos.filter((v: Video) => !existingIds.has(v.id));
              return [...prev, ...newItems];
            });
          } else {
            setVideos(data.videos);
          }

          setHasMore(Boolean(data.hasMore));
          setAllChannelsSynced(data.allChannelsSynced !== false);
          nextCursorRef.current = data.nextCursor || null;
          setPage(pageNum);
          pageRef.current = pageNum;
          setFetchError(null);
        }
      } catch (err: any) {
        console.error('Failed to load home feed:', err);
        setFetchError(err?.message || 'Could not load videos. Please try again.');
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

  // Mobile (<768px): give the first video a hero slot so viewers have a clear starting point,
  // followed by a 2-column grid to compare videos at a glance.
  const showMobileHero = !isDesktop && filteredVideos.length > 0;
  const heroVideo = showMobileHero ? filteredVideos[0] : null;
  const gridVideos = showMobileHero ? filteredVideos.slice(1) : filteredVideos;

  return (
    <PageShell>
      <div className="space-y-4 pb-16">
        {/* Category Navigation + Labelled Shuffle */}
        <div className="flex items-center gap-2">
          <CategoryChips
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            onShuffle={handleRefresh}
            isShuffling={loading}
            showShuffle={videos.length > 0}
          />
        </div>

        {/* Video Feed */}
        <section aria-label="Videos feed" className="space-y-5">
          {loading ? (
            <div className="space-y-5">
              {/* Mobile Hero Skeleton */}
              <div className="md:hidden">
                <VideoCardSkeleton count={1} layout="hero" />
              </div>
              {/* Responsive Grid Skeleton */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-5 gap-y-5">
                <VideoCardSkeleton count={10} />
              </div>
            </div>
          ) : fetchError && videos.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50dvh]">
              <div className="max-w-md w-full text-center space-y-4 p-6 rounded-3xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <AlertCircle size={24} />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display font-bold text-lg text-[var(--color-text-primary)]">
                    Could not load your feed
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{fetchError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchFeed(1, false, seedRef.current, null)}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#b43d2d] text-white hover:bg-[#9b3024] active:scale-95 transition-all"
                >
                  <RefreshCw size={15} />
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          ) : videos.length === 0 ? (
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
                      className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#b43d2d] text-white shadow-sm hover:bg-[#9b3024] active:scale-95 transition-all"
                    >
                      <Plus size={16} />
                      <span>Manage &amp; Add Channels</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : filteredVideos.length === 0 ? (
            /* Empty category state when feed has videos, but none match the selected category */
            <div className="flex items-center justify-center min-h-[42dvh]">
              <div className="max-w-md w-full text-center space-y-4 p-6 rounded-3xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sparkles size={22} />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display font-bold text-lg text-[var(--color-text-primary)]">
                    No {activeCategory} videos right now
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    None of the currently loaded videos match &ldquo;{activeCategory}&rdquo;. Show all videos or shuffle for a fresh mix.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('All')}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#b43d2d] text-white hover:bg-[#9b3024] active:scale-95 transition-all"
                  >
                    <span>Show All Videos</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-red-400/50 active:scale-95 transition-all"
                  >
                    <Shuffle size={15} />
                    <span>Shuffle Feed</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Hero Slot */}
              {heroVideo && (
                <div className="md:hidden space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9c3529] dark:text-[#ffad95]">
                      {activeCategory === 'All' ? 'Featured Pick' : `${activeCategory} Pick`}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                      {filteredVideos.length} videos
                    </span>
                  </div>
                  <VideoCard video={heroVideo} layout="hero" />
                </div>
              )}

              {/* Remaining Videos in 2-col Mobile / 3-6 col Desktop Virtualized Grid */}
              {gridVideos.length > 0 && (
                <VirtualizedVideoGrid
                  videos={gridVideos}
                  onLoadMore={handleLoadMore}
                  hasMore={hasMore}
                  isLoading={loadingMore}
                />
              )}
            </>
          )}

          {/* Continuous look-ahead pre-load indicator */}
          {loadingMore && (
            <div className="pt-6 pb-4 flex justify-center">
              <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-sm">
                <Loader2 size={15} className="animate-spin text-red-500" />
                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Loading more videos…</span>
              </div>
            </div>
          )}

          {/* Pagination error with retry */}
          {fetchError && videos.length > 0 && !loading && !loadingMore && (
            <div className="pt-6 pb-4 flex flex-col items-center gap-3">
              <p className="text-fluid-sm text-red-500 dark:text-red-400 font-medium">
                {fetchError}
              </p>
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-fluid-sm font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Manual load-more fallback */}
          {hasMore && !loadingMore && !loading && !fetchError && filteredVideos.length > 0 && (
            <div className="pt-4 pb-2 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-fluid-sm font-semibold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-all"
              >
                <span>Load More Videos</span>
              </button>
            </div>
          )}

          {/* End states */}
          {!hasMore && !loading && filteredVideos.length > 0 && !allChannelsSynced && (
            <div className="pt-6 pb-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Loader2 size={14} className="animate-spin" />
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Still importing videos — more will appear as channels finish syncing
                </p>
              </div>
            </div>
          )}

          {!hasMore && !loading && filteredVideos.length > 0 && allChannelsSynced && (
            <div className="pt-6 pb-4 flex justify-center">
              <p className="text-[11px] font-medium text-[var(--color-text-disabled)] tracking-wide uppercase">
                — You&apos;ve reached the end of your feed —
              </p>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

const CATEGORY_EMOJIS: Record<string, string> = {
  All: '✨',
  Bhajans: '🎵',
  Stories: '📖',
  Education: '🎓',
  Cartoons: '🎨',
  Nature: '🌿',
  Festivals: '🎉',
  Yoga: '🧘',
};

function CategoryChips({
  activeCategory,
  onSelect,
  onShuffle,
  isShuffling,
  showShuffle,
}: {
  activeCategory: string;
  onSelect: (cat: string) => void;
  onShuffle: () => void;
  isShuffling: boolean;
  showShuffle: boolean;
}) {
  const categories = ['All', 'Bhajans', 'Stories', 'Education', 'Cartoons', 'Nature', 'Festivals', 'Yoga'];

  return (
    <nav aria-label="Content categories" className="relative flex-1 min-w-0">
      <ul
        role="list"
        className="flex items-center gap-2 overflow-x-auto md:flex-wrap pb-1.5 scrollbar-hide -mx-1 px-1"
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
                  'relative min-h-[38px] px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1.5',
                  'focus-visible:ring-2 focus-visible:ring-red-500/60 active:scale-95',
                  isSelected
                    ? [
                        'bg-[#74382f] text-[#fff7ef] dark:bg-[#f1c1a6] dark:text-[#342129]',
                        'shadow-sm border border-transparent',
                      ]
                    : [
                        'bg-[var(--color-bg-elevated)]',
                        'border border-[var(--color-border)]',
                        'text-[var(--color-text-secondary)]',
                        'hover:text-[var(--color-text-primary)] hover:border-neutral-400/70 dark:hover:border-white/20',
                      ]
                )}
                aria-pressed={isSelected}
              >
                <span className="text-[12px] leading-none" aria-hidden="true">{CATEGORY_EMOJIS[cat]}</span>
                <span>{cat}</span>
              </button>
            </li>
          );
        })}

        {showShuffle && (
          <li className="shrink-0 ml-auto md:ml-1">
            <button
              type="button"
              onClick={onShuffle}
              disabled={isShuffling}
              className={cn(
                'min-h-[38px] px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1.5',
                'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)] hover:border-[#903d30]/50 dark:hover:border-[#f2b59a]/50',
                'focus-visible:ring-2 focus-visible:ring-red-500/60 active:scale-95',
                isShuffling && 'opacity-60'
              )}
              title="Shuffle feed"
            >
              <Shuffle size={13} className={cn('text-[#903d30] dark:text-[#f2b59a]', isShuffling && 'animate-spin')} />
              <span>Shuffle</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
