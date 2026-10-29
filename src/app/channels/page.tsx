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
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* ── Hero Header ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-red-500 to-rose-500 p-6 sm:p-8 shadow-xl shadow-red-500/25">
          {/* Decorative background blobs */}
          <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-rose-300/20 blur-2xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white shadow-lg border border-white/20 shrink-0">
                <Tv2 size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                    Curated Channels
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-sm shadow-sm">
                    <CheckCircle2 size={11} /> Safe Library
                  </span>
                </div>
                <p className="text-white/70 text-sm mt-1 font-medium">
                  Parent-approved channels with 100% safe content
                </p>
              </div>
            </div>

            {role === 'parent' && (
              <Link
                href="/settings/manage-channels"
                className={cn(
                  'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shrink-0',
                  'bg-white text-red-600 shadow-xl shadow-red-900/20',
                  'hover:bg-neutral-50 hover:scale-[1.02] active:scale-95 transition-all duration-200'
                )}
              >
                <Sparkles size={16} />
                <span>Manage Channels</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── Search & Filter Bar ─────────────────────────────────────── */}
        {!loading && channels.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search approved channels…"
                className={cn(
                  'w-full h-11 pl-10 pr-9 rounded-2xl text-sm font-medium',
                  'bg-white dark:bg-white/[0.05]',
                  'border border-neutral-200 dark:border-white/[0.08]',
                  'text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                  'focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-400/60 transition-all shadow-sm'
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {[
                { key: 'all' as const, label: `All (${channels.length})`, icon: null },
                { key: 'popular' as const, label: 'Popular', icon: <Flame size={12} /> },
                { key: 'videos' as const, label: 'Most Videos', icon: <Video size={12} /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortBy(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200',
                    sortBy === key
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md shadow-red-500/25'
                      : 'bg-white dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-white/[0.08] hover:border-neutral-300 dark:hover:border-red-400/30 hover:bg-neutral-50 dark:hover:bg-white/[0.08]'
                  )}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-5 rounded-3xl bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] animate-pulse space-y-3.5"
              >
                <div className="h-20 w-20 rounded-2xl bg-neutral-200 dark:bg-white/[0.08]" />
                <div className="h-4 w-28 bg-neutral-200 dark:bg-white/[0.08] rounded-lg" />
                <div className="h-3 w-20 bg-neutral-100 dark:bg-white/[0.05] rounded-lg" />
                <div className="h-9 w-full bg-neutral-100 dark:bg-white/[0.05] rounded-2xl mt-1" />
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
