'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { formatWatchDuration } from '@/lib/formatters';
import { DailyActivityCalendar } from './DailyActivityCalendar';
import { ChannelBarChart } from './ChannelBarChart';

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

interface ChildProgressViewProps {
  /** The child whose data is being shown */
  childId: string;
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
    <div className="flex-1 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-center shadow-xs">
      <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
        <Icon size={16} />
      </div>
      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-bold">{label}</p>
      {loading ? (
        <div className="h-6 w-14 mx-auto mt-1 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      ) : (
        <p className="font-extrabold text-neutral-900 dark:text-white text-fluid-base mt-0.5 tracking-tight">{value}</p>
      )}
    </div>
  );
}

export function ChildProgressView({ childId, accessToken }: ChildProgressViewProps) {


  // Summary state
  const [summary, setSummary] = useState<WatchSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // All-channels expand state
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [allChannels, setAllChannels] = useState<ChannelEntry[] | null>(null);
  const [allChannelsLoading, setAllChannelsLoading] = useState(false);

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
        const res = await fetch('/api/watch-summary', {
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
      const res = await fetch('/api/watch-channels', {
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

  const displayedChannels = showAllChannels
    ? (allChannels ?? summary?.top_channels ?? [])
    : (summary?.top_channels ?? []);

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

      <DailyActivityCalendar childId={childId} accessToken={accessToken} />
    </div>
  );
}
