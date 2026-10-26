'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { VideoCard, VideoCardSkeleton } from '@/components/cards/VideoCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tv2, Plus, Sparkles, Loader2, RefreshCw } from 'lucide-react';
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
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1000000));
  const [activeCategory, setActiveCategory] = useState('All');

  /* Item 11: Infinite scroll — sentinel ref and IntersectionObserver */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const pageRef = useRef(1);
  const seedRef = useRef(seed);

  const fetchFeed = useCallback(async (pageNum: number = 1, append: boolean = false, currentSeed: number = seed) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      loadingMoreRef.current = true;

      const res = await fetch(`/api/feed/home?page=${pageNum}&pageSize=20&seed=${currentSeed}`);
      const data = await res.json();

      if (data.videos) {
        if (append) {
          setVideos((prev) => [...prev, ...data.videos]);
        } else {
          setVideos(data.videos);
        }
        setHasMore(data.hasMore || false);
        hasMoreRef.current = data.hasMore || false;
        setPage(pageNum);
        pageRef.current = pageNum;
      }
    } catch (err) {
      console.error('Failed to load home feed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [seed]);

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    if (initialized) {
      fetchFeed(1, false, seed);
    }
  }, [initialized, seed, fetchFeed]);

  /* Item 11: IntersectionObserver to auto-load next page */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          const nextPage = pageRef.current + 1;
          fetchFeed(nextPage, true, seedRef.current);
        }
      },
      { rootMargin: '0px 0px 400px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchFeed]);

  const handleRefresh = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
  };

  // Filter by category chip with smart stem matching (e.g. Stories -> Story, Bhajans -> Bhajan)
  const filteredVideos = activeCategory === 'All'
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
        return title.includes(lowerCat) || title.includes(stem) || ch.includes(lowerCat) || ch.includes(stem);
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

        {/* Video Card Grid — Item 2: Edge-to-edge on mobile via negative margin */}
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
            /* Item 2: -mx-3/4 bleeds thumbnails to screen edges on mobile.
               gap-0 on mobile for true edge-to-edge, gap-4 on sm+ for card spacing. */
            <div className="-mx-3 sm:-mx-4 md:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0 sm:gap-4 gap-y-6">
              {filteredVideos.map((vid) => (
                <VideoCard key={vid.id} video={vid} />
              ))}
            </div>
          )}

          {/* Item 11: Infinite scroll sentinel + loading indicator */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />

          {loadingMore && (
            <div className="pt-6 pb-4 flex justify-center">
              <div className="flex items-center gap-2 text-content-secondary">
                <Loader2 size={16} className="animate-spin text-brand-primary" />
                <span className="text-fluid-sm">Loading more videos…</span>
              </div>
            </div>
          )}

          {!hasMore && !loading && videos.length > 0 && (
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
