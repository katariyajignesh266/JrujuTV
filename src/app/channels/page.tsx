'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Tv2, Plus, Sparkles, Search, X, CheckCircle2, Flame, Video, SlidersHorizontal } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { getChannels } from '@/lib/api/channels';
import { Channel } from '@/types/content';
import { cn } from '@/lib/cn';

export default function ChannelsPage() {
  const { role, initialized } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'all' | 'popular' | 'videos'>('all');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getChannels();
        if (isMounted) {
          // For public / child view, only show active channels
          const filtered = role === 'parent' ? data : data.filter((c) => c.is_active);
          setChannels(filtered);
        }
      } catch (err) {
        console.error('Failed to load channels:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (initialized) {
      load();
    }
    return () => {
      isMounted = false;
    };
  }, [initialized, role]);

  // Filter & sort channels
  const filteredChannels = useMemo(() => {
    let result = channels.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    if (sortBy === 'popular') {
      result = [...result].sort((a, b) => (b.subscriber_count || 0) - (a.subscriber_count || 0));
    } else if (sortBy === 'videos') {
      result = [...result].sort((a, b) => (b.video_count || 0) - (a.video_count || 0));
    }

    return result;
  }, [channels, searchQuery, sortBy]);

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto space-y-5 pb-16">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-brand-primary via-red-600 to-brand-secondary flex items-center justify-center text-white shadow-md shadow-brand-primary/20 shrink-0">
              <Tv2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-fluid-xl font-bold text-content-primary">
                  Curated Channels
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <CheckCircle2 size={11} /> Safe Library
                </span>
              </div>
              <p className="text-fluid-sm text-content-secondary mt-0.5">
                Channels approved by parents with safe, kid-friendly content
              </p>
            </div>
          </div>

          {/* Parent CTA Button */}
          {role === 'parent' && (
            <Link
              href="/settings/manage-channels"
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-bold text-white shrink-0',
                'bg-gradient-to-r from-brand-primary via-red-600 to-brand-secondary shadow-lg shadow-brand-primary/25',
                'hover:shadow-brand-primary/40 hover:scale-[1.02] active:scale-95 transition-all duration-200'
              )}
            >
              <Sparkles size={16} />
              <span>Manage Channels</span>
            </Link>
          )}
        </div>

        {/* Search & Filter Bar */}
        {!loading && channels.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search approved channels…"
                className={cn(
                  'w-full h-10 pl-9 pr-8 rounded-xl text-fluid-sm font-medium',
                  'bg-surface-secondary border border-border/80 text-content-primary placeholder:text-content-disabled',
                  'focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all shadow-xs'
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-disabled hover:text-content-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              <button
                type="button"
                onClick={() => setSortBy('all')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                  sortBy === 'all'
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary hover:bg-surface-elevated border border-border/80'
                )}
              >
                All ({channels.length})
              </button>
              <button
                type="button"
                onClick={() => setSortBy('popular')}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                  sortBy === 'popular'
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary hover:bg-surface-elevated border border-border/80'
                )}
              >
                <Flame size={12} />
                <span>Popular</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy('videos')}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                  sortBy === 'videos'
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary hover:bg-surface-elevated border border-border/80'
                )}
              >
                <Video size={12} />
                <span>Most Videos</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 pt-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-5 rounded-3xl bg-surface-secondary/70 border border-border/60 animate-pulse space-y-3"
              >
                <div className="h-20 w-20 rounded-2xl bg-surface-elevated" />
                <div className="h-4 w-24 bg-surface-elevated rounded-md" />
                <div className="h-3 w-16 bg-surface-elevated rounded-md" />
                <div className="h-8 w-full bg-surface-elevated rounded-xl mt-2" />
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="flex items-center justify-center min-h-[50dvh]">
            <div className="max-w-md w-full text-center space-y-4">
              <EmptyState
                icon={Tv2}
                title={role === 'parent' ? 'No Channels Added Yet' : 'No Channels Available'}
                description={
                  role === 'parent'
                    ? 'Paste YouTube channel links to whitelist safe videos for your children.'
                    : 'Ask your parents to add channels from YouTube so you can watch fun and safe videos!'
                }
              />
              {role === 'parent' && (
                <div className="pt-2">
                  <Link
                    href="/settings/manage-channels"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-fluid-sm font-bold bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                    <span>Add Your First Channel</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-fluid-base font-semibold text-content-primary">
              No channels match &quot;{searchQuery}&quot;
            </p>
            <p className="text-fluid-sm text-content-secondary">
              Try searching with another name or clear the search filter.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-secondary border border-border hover:bg-surface-elevated text-content-primary transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 pt-1">
            {filteredChannels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="public" />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
