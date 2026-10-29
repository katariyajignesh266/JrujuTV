'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  TrendingUp,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatWatchDuration, formatRelativeTime } from '@/lib/formatters';
import { ChannelBarChart } from './ChannelBarChart';
import { EmptyState } from '@/components/shared/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChannelEntry {
  channel_id: string;
  channel_name: string;
  channel_thumbnail?: string;
  total_seconds: number;
}

interface WatchSummary {
  lifetime_seconds: number;
  today_seconds: number;
  top_channels: ChannelEntry[];
  total_channel_count: number;
}

interface HistorySession {
  id: string;
  video_id: string;
  youtube_video_id?: string;
  channel_id: string;
  watched_seconds: number;
  video_duration_seconds: number;
  progress_percent: number;
  absolute_position: number;
  last_watched_at: string;
  video_title: string;
  video_thumbnail: string;
  channel_name: string;
}

interface ChildProgressViewProps {
  /** The child whose data is being shown */
  childId: string;
  /** 'parent': the parent is viewing a child's detail panel. 'child': child viewing own progress. */
  viewerRole: 'parent' | 'child';
  /** Access token to call edge functions with */
  accessToken: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

function efUrl(name: string) {
  return `${supabaseUrl()}/functions/v1/${name}`;
}

function StatChip({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="flex-1 p-3.5 rounded-2xl bg-surface-secondary/70 border border-border/80 text-center shadow-xs">
      <div className="h-8 w-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
        <Icon size={16} />
      </div>
      <p className="text-[10px] text-content-secondary uppercase tracking-wider font-bold">{label}</p>
      {loading ? (
        <div className="h-6 w-14 mx-auto mt-1 rounded-md bg-surface-elevated animate-pulse" />
      ) : (
        <p className="font-extrabold text-content-primary text-fluid-base mt-0.5 tracking-tight">{value}</p>
      )}
    </div>
  );
}

function ProgressBadge({ pct }: { pct: number }) {
  if (pct >= 95) {
    return (
      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shrink-0">
        ✓ Completed
      </span>
    );
  }
  if (pct <= 2) {
    return (
      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-content-disabled border border-border/60 shrink-0">
        Just started
      </span>
    );
  }
  return (
    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shrink-0">
      {pct}% watched
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ChildProgressView({ childId, viewerRole, accessToken }: ChildProgressViewProps) {
  const router = useRouter();

  // Summary state
  const [summary, setSummary] = useState<WatchSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // All-channels expand state
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [allChannels, setAllChannels] = useState<ChannelEntry[] | null>(null);
  const [allChannelsLoading, setAllChannelsLoading] = useState(false);

  // History state
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<{ last_watched_at: string; id: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    authHeaders['apikey'] = anonKey;
  }

  // ── Fetch summary (lifetime + today + top-5 channels) ─────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      if (!childId || !accessToken) return;
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await fetch(efUrl('get-child-watch-summary'), {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ child_id: childId }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled) {
          if (res.ok && data) {
            setSummary(data);
          } else {
            setSummaryError(data?.error ?? 'Failed to load summary');
          }
        }
      } catch {
        if (!cancelled) setSummaryError('Network error');
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    fetchSummary();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, accessToken]);

  // ── Fetch initial history page ─────────────────────────────────────────────
  const fetchHistory = useCallback(async (cursorArg: typeof cursor) => {
    if (!childId || !accessToken) return;
    setHistoryLoading(cursorArg === null);
    setHistoryError(null);
    if (cursorArg !== null) setLoadingMore(true);
    try {
      const res = await fetch(efUrl('get-child-watch-history'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ child_id: childId, limit: 30, cursor: cursorArg }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setSessions((prev) => cursorArg ? [...prev, ...data.sessions] : data.sessions);
        setHasMore(data.has_more ?? false);
        setCursor(data.next_cursor ?? null);
      } else {
        setHistoryError(data?.error ?? 'Failed to load history');
      }
    } catch {
      setHistoryError('Network error');
    } finally {
      setHistoryLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, accessToken]);

  useEffect(() => {
    fetchHistory(null);
  }, [fetchHistory]);

  // ── Intersection observer for "Load More" ──────────────────────────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!hasMore || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchHistory(cursor);
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, cursor, fetchHistory]);

  // ── All-channels fetch ────────────────────────────────────────────────────
  const handleToggleAllChannels = async () => {
    if (showAllChannels) {
      setShowAllChannels(false);
      return;
    }
    setShowAllChannels(true);
    if (allChannels !== null) return; // already loaded
    setAllChannelsLoading(true);
    try {
      const res = await fetch(efUrl('get-child-watch-channels'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ child_id: childId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setAllChannels(data.channels ?? []);
    } catch {
      // fail silently — user can retry by tapping again
    } finally {
      setAllChannelsLoading(false);
    }
  };

  // ── Navigate to video (resumes from saved position via URL param) ─────────
  const handleHistoryItemClick = (session: HistorySession) => {
    // Prefer direct YouTube ID if available from API/RPC, fallback to video UUID
    const videoTarget = session.youtube_video_id || session.video_id;
    router.push(`/videos/${videoTarget}?resume=${Math.floor(session.absolute_position)}`);
  };

  const displayedChannels = showAllChannels
    ? (allChannels ?? summary?.top_channels ?? [])
    : (summary?.top_channels ?? []);

  const hasAnyData =
    (summary?.lifetime_seconds ?? 0) > 0 ||
    (summary?.today_seconds ?? 0) > 0 ||
    sessions.length > 0;

  return (
    <div className="space-y-5 pb-4">
      {/* ── Header Stats ──────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <StatChip
          icon={Clock}
          label="Total watched"
          value={formatWatchDuration(summary?.lifetime_seconds ?? 0)}
          loading={summaryLoading}
        />
        <StatChip
          icon={TrendingUp}
          label="Today"
          value={formatWatchDuration(summary?.today_seconds ?? 0)}
          loading={summaryLoading}
        />
      </div>

      {/* ── Top Channels Graph ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-fluid-base text-content-primary flex items-center gap-1.5">
            <TrendingUp size={15} className="text-brand-primary" />
            Top Channels
          </h3>
          {(summary?.total_channel_count ?? 0) > 5 && (
            <button
              type="button"
              onClick={handleToggleAllChannels}
              className="text-[11px] font-semibold text-brand-primary flex items-center gap-0.5 hover:opacity-75 transition-opacity"
            >
              {showAllChannels ? (
                <>Show Less <ChevronUp size={12} /></>
              ) : (
                <>View All ({summary?.total_channel_count}) <ChevronDown size={12} /></>
              )}
            </button>
          )}
        </div>

        {summaryLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-xl bg-surface-secondary animate-pulse" />
            ))}
          </div>
        ) : summaryError ? null : displayedChannels.length === 0 ? (
          <p className="text-fluid-sm text-content-disabled text-center py-4">
            No channels watched yet
          </p>
        ) : (
          <>
            <ChannelBarChart bars={displayedChannels} />
            {allChannelsLoading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={16} className="animate-spin text-brand-primary" />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Watch History ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="font-semibold text-fluid-base text-content-primary flex items-center gap-1.5 mb-3">
          <History size={15} className="text-brand-primary" />
          Watch History
        </h3>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-2">
                <div className="w-24 h-14 rounded-xl bg-surface-secondary animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 rounded bg-surface-secondary animate-pulse w-3/4" />
                  <div className="h-3 rounded bg-surface-secondary animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : historyError ? (
          <p className="text-fluid-sm text-red-500 text-center py-4">{historyError}</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No watch history yet"
            description={
              viewerRole === 'child'
                ? 'Start watching videos to see your progress here.'
                : 'This child hasn\'t watched any videos yet.'
            }
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => handleHistoryItemClick(session)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-2xl transition-all duration-150 text-left',
                  'bg-surface-secondary/50 hover:bg-surface-secondary border border-border/50 hover:border-border active:scale-[0.99] shadow-2xs'
                )}
              >
                {/* Thumbnail */}
                <div className="relative w-24 shrink-0 aspect-video rounded-xl overflow-hidden bg-surface-secondary">
                  {session.video_thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.video_thumbnail}
                      alt={session.video_title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <PlayCircle size={20} className="text-content-disabled" />
                    </div>
                  )}
                  {/* Progress bar overlay */}
                  {session.progress_percent > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/30">
                      <div
                        className="h-full bg-red-600"
                        style={{ width: `${session.progress_percent}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[13px] font-semibold text-content-primary leading-snug line-clamp-2 mb-1">
                    {session.video_title}
                  </p>
                  <p className="text-[11px] text-content-secondary truncate mb-1.5">
                    {session.channel_name}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-content-disabled">
                      {formatRelativeTime(session.last_watched_at)}
                    </span>
                    <ProgressBadge pct={session.progress_percent} />
                  </div>
                </div>
              </button>
            ))}

            {/* Sentinel for Intersection Observer — "Load More" */}
            <div ref={sentinelRef} className="h-4" />

            {loadingMore && (
              <div className="flex items-center justify-center py-3 gap-2 text-content-secondary text-fluid-sm">
                <Loader2 size={16} className="animate-spin" />
                Loading more…
              </div>
            )}

            {!hasMore && sessions.length > 0 && (
              <p className="text-center text-[11px] text-content-disabled py-3">
                All {sessions.length} {sessions.length === 1 ? 'video' : 'videos'} shown
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
