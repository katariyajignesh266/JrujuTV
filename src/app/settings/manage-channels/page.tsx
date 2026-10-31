'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Tv2,
  ArrowLeft,
  Search,
  Loader2,
  AlertCircle,
  Plus,
  RefreshCw,
  X,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Zap,
  Sparkles,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { ChannelPreviewCard } from '@/components/channels/ChannelPreviewCard';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import {
  fetchChannelDetails,
  addChannel,
  getChannels,
  toggleChannelActive,
  syncChannel,
  deleteChannel,
  updateChannelShortsSettings,
} from '@/lib/api/channels';
import { Channel, ChannelPreview } from '@/types/content';
import { cn } from '@/lib/cn';

/** Maximum continuation polling iterations per channel before marking stalled */
const MAX_CONTINUATION_POLLS = 200;
/** Interval between continuation polling calls (ms) */
const POLL_INTERVAL_MS = 3000;

interface SyncProgress {
  status: 'idle' | 'polling' | 'complete' | 'stalled';
  syncedVideoCount: number;
  totalVideoCount: number;
  pct: number;
}

function calcProgress(synced: number, total: number): SyncProgress {
  const pct = total > 0 ? Math.min(100, Math.round((synced / total) * 100)) : 0;
  return { status: 'polling', syncedVideoCount: synced, totalVideoCount: total, pct };
}

export default function ManageChannelsPage() {
  const { role, initialized } = useAuthStore();
  const router = useRouter();
  const { openAuthModal } = useUIStore();

  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Per-channel sync in-progress tracking (replaces simple syncingMap)
  const [syncProgressMap, setSyncProgressMap] = useState<Record<string, SyncProgress>>({});

  // Polling interval refs — keyed by channelId so multiple channels can poll concurrently
  const pollCountRef = useRef<Record<string, number>>({});
  const pollTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Delete modal state
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Shorts settings review nudge
  const [showShortsNudge, setShowShortsNudge] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const reviewed = localStorage.getItem('jruju_shorts_nudge_reviewed');
      if (!reviewed) {
        setShowShortsNudge(true);
      }
    }
  }, []);

  const dismissShortsNudge = () => {
    localStorage.setItem('jruju_shorts_nudge_reviewed', 'true');
    setShowShortsNudge(false);
  };

  const handleUpdateShortsSettings = async (
    channel: Channel,
    enabled: boolean,
    limit: number | null
  ) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id
          ? { ...c, shorts_enabled: enabled, shorts_limit: limit }
          : c
      )
    );

    try {
      await updateChannelShortsSettings(channel.id, enabled, limit);
    } catch (err) {
      console.error('Failed to update channel shorts settings:', err);
    }
  };

  const loadChannelsList = useCallback(async () => {
    try {
      setLoadingChannels(true);
      const data = await getChannels();
      setChannels(data);
      // Resume polling for any channel still in_progress after a page refresh
      data.forEach((ch) => {
        if (ch.sync_status === 'pending' || ch.sync_status === 'in_progress') {
          if (!pollTimerRef.current[ch.id]) {
            startContinuationPolling(ch.id, ch.synced_video_count ?? 0, ch.total_video_count ?? 0);
          }
        }
      });
    } catch (err: any) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialized && role === 'parent') {
      loadChannelsList();
    }
    const currentTimers = pollTimerRef.current;
    // Cleanup all polling on unmount
    return () => {
      Object.values(currentTimers).forEach(clearTimeout);
    };
  }, [role, initialized, loadChannelsList]);

  /** Start a continuation polling loop for a channel that isn't fully synced yet. */
  const startContinuationPolling = useCallback(
    (channelId: string, initialSynced: number, initialTotal: number) => {
      pollCountRef.current[channelId] = 0;

      // Set initial progress state
      setSyncProgressMap((prev) => ({
        ...prev,
        [channelId]: {
          ...calcProgress(initialSynced, initialTotal),
          status: 'polling',
        },
      }));

      const poll = async () => {
        const count = pollCountRef.current[channelId] ?? 0;

        if (count >= MAX_CONTINUATION_POLLS) {
          // Safety cap hit — mark stalled, let daily cron finish it
          setSyncProgressMap((prev) => ({
            ...prev,
            [channelId]: { ...prev[channelId], status: 'stalled' },
          }));
          delete pollTimerRef.current[channelId];
          return;
        }

        try {
          const result = await syncChannel(channelId, false);
          pollCountRef.current[channelId] = count + 1;

          const synced = result.syncedVideoCount ?? 0;
          const total = result.totalVideoCount ?? initialTotal;

          if (result.complete) {
            // Full sync completed!
            setSyncProgressMap((prev) => ({
              ...prev,
              [channelId]: { status: 'complete', syncedVideoCount: synced, totalVideoCount: total, pct: 100 },
            }));
            // Refresh the channels list to get updated sync_status from DB
            await loadChannelsList();
            delete pollTimerRef.current[channelId];
          } else {
            // More pages remain — update progress and schedule next poll
            setSyncProgressMap((prev) => ({
              ...prev,
              [channelId]: {
                ...calcProgress(synced, total),
                status: 'polling',
              },
            }));
            pollTimerRef.current[channelId] = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (err) {
          // Network error — retry after a longer delay
          console.warn(`Sync poll error for channel ${channelId}:`, err);
          pollCountRef.current[channelId] = count + 1;
          pollTimerRef.current[channelId] = setTimeout(poll, POLL_INTERVAL_MS * 3);
        }
      };

      // Start the first poll immediately
      pollTimerRef.current[channelId] = setTimeout(poll, 500);
    },
    [loadChannelsList]
  );

  if (initialized && role !== 'parent') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-16 px-4 space-y-4">
          <div className="h-16 w-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary mx-auto mb-2">
            <ShieldAlert size={32} />
          </div>
          <h2 className="font-display font-bold text-fluid-xl text-content-primary">
            Parent Access Required
          </h2>
          <p className="text-fluid-sm text-content-secondary leading-relaxed">
            Only parents can add, hide, or manage YouTube channels. Please sign in with your parent
            account to access channel controls.
          </p>
          <div className="pt-3 flex justify-center gap-3">
            <Link
              href="/settings"
              className="px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-surface-secondary border border-border text-content-secondary hover:bg-surface-elevated transition-colors"
            >
              Back to Settings
            </Link>
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-brand-primary text-white shadow-md shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-95 transition-all"
            >
              Log In as Parent
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // Handle Fetch Details
  const handleFetchDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) return;

    setIsFetching(true);
    setFetchError(null);
    setPreview(null);

    try {
      const data = await fetchChannelDetails(cleanUrl);
      setPreview(data);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch channel details. Check the URL and try again.');
    } finally {
      setIsFetching(false);
    }
  };

  // Handle Add Channel — returns immediately (no inline sync), then starts polling
  const handleAddChannel = async (previewItem: ChannelPreview) => {
    setIsAdding(true);
    try {
      const newChannel = await addChannel(previewItem);
      setUrlInput('');
      setPreview(null);

      // Add optimistic channel to list immediately with pending status
      const optimisticChannel: Channel = {
        ...newChannel,
        sync_status: 'pending',
        synced_video_count: 0,
        total_video_count: previewItem.video_count || 0,
        name: newChannel.title,
        avatarUrl: newChannel.thumbnail_url,
      };
      setChannels((prev) => [optimisticChannel, ...prev]);

      // Begin continuation polling immediately
      startContinuationPolling(
        newChannel.id,
        0,
        previewItem.video_count || 0
      );
    } catch (err: any) {
      setFetchError(err.message || 'Failed to add channel.');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Toggle Active (Hide/Unhide)
  const handleToggleActive = async (ch: Channel) => {
    const nextState = !ch.is_active;
    setChannels((prev) =>
      prev.map((c) => (c.id === ch.id ? { ...c, is_active: nextState } : c))
    );
    try {
      await toggleChannelActive(ch.id, nextState);
    } catch (err) {
      console.error('Failed to toggle active state:', err);
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, is_active: ch.is_active } : c))
      );
    }
  };

  // Handle Manual Sync — incremental for complete channels, full-resume for others
  const handleSync = async (ch: Channel) => {
    const isIncremental = ch.sync_status === 'complete';

    if (!isIncremental) {
      // Resume/restart full sync — begin continuation polling
      startContinuationPolling(ch.id, ch.synced_video_count ?? 0, ch.total_video_count ?? 0);
      return;
    }

    // Incremental refresh for fully-synced channels
    setSyncProgressMap((prev) => ({
      ...prev,
      [ch.id]: { status: 'polling', syncedVideoCount: 0, totalVideoCount: 0, pct: 0 },
    }));
    try {
      await syncChannel(ch.id, true);
      await loadChannelsList();
    } catch (err) {
      console.error('Incremental sync failed:', err);
    } finally {
      setSyncProgressMap((prev) => {
        const next = { ...prev };
        delete next[ch.id];
        return next;
      });
    }
  };

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!channelToDelete) return;
    setIsDeleting(true);
    try {
      // Stop any active polling for this channel first
      if (pollTimerRef.current[channelToDelete.id]) {
        clearTimeout(pollTimerRef.current[channelToDelete.id]);
        delete pollTimerRef.current[channelToDelete.id];
      }
      await deleteChannel(channelToDelete.id);
      setChannels((prev) => prev.filter((c) => c.id !== channelToDelete.id));
      setChannelToDelete(null);
    } catch (err) {
      console.error('Failed to delete channel:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        {/* Navigation Header */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/settings"
            className="h-10 w-10 rounded-2xl flex items-center justify-center text-content-secondary hover:text-content-primary bg-surface-secondary border border-border/80 hover:bg-surface-elevated transition-colors shadow-xs shrink-0"
            aria-label="Back to Settings"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-fluid-xl font-bold text-content-primary flex items-center gap-2.5 truncate">
              <span className="h-8 w-8 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-sm shrink-0">
                <Tv2 size={18} />
              </span>
              <span className="truncate">Manage YouTube Channels</span>
            </h1>
            <p className="text-fluid-sm text-content-secondary mt-0.5 truncate">
              Add and curate approved channels for your kids.
            </p>
          </div>
        </div>

        {/* ── 1. Paste Link & Fetch Section (Ultra-Premium Card) ── */}
        <div className="relative w-full max-w-full overflow-hidden rounded-3xl bg-surface-secondary/80 backdrop-blur-xl border border-border/80 p-5 sm:p-6 space-y-4 shadow-sm">
          {/* Animated scanning beam while fetching */}
          {isFetching && (
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-brand-primary to-transparent animate-shimmer-slide z-10" />
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-fluid-base text-content-primary flex items-center gap-2">
                <span>Add a YouTube Channel</span>
              </h2>
              <p className="text-[12px] text-content-secondary mt-0.5">
                Paste any YouTube channel link or @handle to scan and import.
              </p>
            </div>
          </div>

          <form onSubmit={handleFetchDetails} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled pointer-events-none"
                  size={18}
                />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (fetchError) setFetchError(null);
                  }}
                  placeholder="Paste URL or @handle (e.g. @SuperSimpleSongs)"
                  className={cn(
                    'w-full h-12 pl-10 pr-20 rounded-2xl text-fluid-sm font-medium',
                    'bg-surface-elevated border border-border/80 text-content-primary placeholder:text-content-disabled',
                    'focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all shadow-xs'
                  )}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {urlInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrlInput('');
                        setFetchError(null);
                        setPreview(null);
                      }}
                      className="p-1.5 rounded-lg text-content-disabled hover:text-content-primary hover:bg-surface-secondary transition-colors"
                      title="Clear"
                    >
                      <X size={15} />
                    </button>
                  )}
                  {typeof navigator !== 'undefined' && navigator.clipboard && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setUrlInput(text.trim());
                            if (fetchError) setFetchError(null);
                          }
                        } catch {}
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors"
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isFetching || !urlInput.trim()}
                className={cn(
                  'h-12 px-6 rounded-2xl font-bold text-fluid-sm text-white shrink-0',
                  'bg-gradient-to-r from-brand-primary to-brand-secondary shadow-md shadow-brand-primary/20',
                  'hover:shadow-brand-primary/35 hover:scale-[1.01] active:scale-95 transition-all',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
                  'flex items-center justify-center gap-2'
                )}
              >
                {isFetching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Scanning…</span>
                  </>
                ) : (
                  <span>Fetch Details</span>
                )}
              </button>
            </div>

            {/* Example helper chips placed clean below the button as requested */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-content-disabled font-medium mr-1">Examples:</span>
              <button
                type="button"
                onClick={() => setUrlInput('https://www.youtube.com/@SuperSimpleSongs')}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-elevated hover:bg-surface-primary border border-border/80 text-content-secondary hover:text-brand-primary transition-colors cursor-pointer"
              >
                @SuperSimpleSongs
              </button>
              <button
                type="button"
                onClick={() => setUrlInput('https://www.youtube.com/@CoComelon')}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-elevated hover:bg-surface-primary border border-border/80 text-content-secondary hover:text-brand-primary transition-colors cursor-pointer"
              >
                @CoComelon
              </button>
              <button
                type="button"
                onClick={() => setUrlInput('https://www.youtube.com/@LIVComedy')}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-elevated hover:bg-surface-primary border border-border/80 text-content-secondary hover:text-brand-primary transition-colors cursor-pointer"
              >
                @LIVComedy
              </button>
            </div>
          </form>

          {/* Scanning In-Progress Holographic Radar Banner */}
          {isFetching && (
            <div className="p-4 rounded-2xl bg-brand-primary/[0.06] border border-brand-primary/20 space-y-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5 text-brand-primary">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-primary"></span>
                </span>
                <span className="text-xs font-bold tracking-wide uppercase">
                  Connecting to YouTube &amp; Scanning Channel…
                </span>
              </div>
              <p className="text-[11.5px] text-content-secondary leading-relaxed pl-5">
                Fetching channel title, verified status, subscriber count, and verified playlist videos.
              </p>
            </div>
          )}

          {/* Fetch Error Banner */}
          {fetchError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm animate-in fade-in duration-150">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="text-xs font-medium">{fetchError}</span>
            </div>
          )}

          {/* Preview Card */}
          {preview && (
            <div className="pt-2">
              <ChannelPreviewCard preview={preview} onAdd={handleAddChannel} isAdding={isAdding} />
            </div>
          )}
        </div>

        {/* ── 2. Added Channels List ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-fluid-lg text-content-primary">
                Your Added Channels ({channels.length})
              </h2>
              <p className="text-[11px] text-content-secondary">
                Control which channels are visible to your children
              </p>
            </div>
            <button
              type="button"
              onClick={loadChannelsList}
              disabled={loadingChannels}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-elevated border border-border/80 text-xs font-semibold text-content-secondary hover:text-brand-primary transition-all active:scale-95 shadow-xs"
            >
              <RefreshCw size={13} className={cn(loadingChannels && 'animate-spin text-brand-primary')} />
              <span>Reload</span>
            </button>
          </div>

          {loadingChannels ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-surface-secondary border border-border">
              <Loader2 className="h-8 w-8 text-brand-primary animate-spin mb-2" />
              <p className="text-fluid-sm text-content-secondary">Loading your channels…</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-surface-secondary border border-border space-y-2">
              <div className="h-14 w-14 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-2">
                <Tv2 size={26} />
              </div>
              <h3 className="font-semibold text-fluid-base text-content-primary">
                No Channels Added Yet
              </h3>
              <p className="text-fluid-sm text-content-secondary max-w-sm">
                Paste a YouTube channel link above to begin curating safe videos for your kids.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => {
                const progress = syncProgressMap[ch.id];
                const isPolling = progress?.status === 'polling';
                const isStalled = progress?.status === 'stalled';
                const isSyncing =
                  isPolling ||
                  ch.sync_status === 'pending' ||
                  ch.sync_status === 'in_progress';

                return (
                  <div key={ch.id} className="space-y-0">
                    <ChannelCard
                      channel={ch}
                      variant="admin"
                      onToggleActive={handleToggleActive}
                      onSync={handleSync}
                      onDelete={(c) => setChannelToDelete(c)}
                      isSyncing={isSyncing}
                    />

                    {/* Sync progress indicator — shown during active ingestion */}
                    {(isPolling || isStalled || ch.sync_status === 'in_progress' || ch.sync_status === 'pending') && (
                      <div
                        className={cn(
                          'w-full max-w-full overflow-hidden px-4 py-3 rounded-b-2xl border border-t-0 space-y-2',
                          isStalled
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-brand-primary/5 border-brand-primary/15'
                        )}
                      >
                        {isStalled ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-500">
                              <Clock size={14} />
                              <span className="text-xs font-medium">
                                Import paused — will resume on next daily sync
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                startContinuationPolling(
                                  ch.id,
                                  progress?.syncedVideoCount ?? 0,
                                  progress?.totalVideoCount ?? 0
                                )
                              }
                              className="text-xs font-semibold text-amber-500 hover:text-amber-400 underline"
                            >
                              Continue
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-brand-primary">
                                <Loader2 size={13} className="animate-spin" />
                                <span className="text-xs font-medium">
                                  Importing videos…{' '}
                                  {progress
                                    ? `${progress.syncedVideoCount.toLocaleString()} / ${progress.totalVideoCount.toLocaleString()}`
                                    : `${(ch.synced_video_count ?? 0).toLocaleString()} / ${(ch.total_video_count ?? 0).toLocaleString()}`}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-brand-primary">
                                {progress?.pct ?? 0}%
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1.5 bg-brand-primary/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-primary rounded-full transition-all duration-500"
                                style={{ width: `${progress?.pct ?? 0}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-content-secondary">
                              More videos will appear as the import progresses. Large channels may
                              take a few minutes.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Complete badge */}
                    {progress?.status === 'complete' && (
                      <div className="w-full max-w-full overflow-hidden px-4 py-2 rounded-b-2xl border border-t-0 bg-emerald-500/5 border-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-500">
                          <CheckCircle2 size={14} />
                          <span className="text-xs font-semibold">
                            All videos imported — {progress.syncedVideoCount.toLocaleString()} videos synced
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {channelToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-surface-elevated rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-fluid-lg text-content-primary">
                    Remove Channel?
                  </h3>
                  <p className="text-[11px] text-red-400 font-medium">All cached videos will be deleted</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className="text-content-secondary hover:text-content-primary rounded-full p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/[0.08] border border-red-500/20 text-fluid-sm text-content-secondary leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-content-primary">{channelToDelete.title}</span>?
              Your children will immediately lose access to all videos from this channel.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl font-semibold text-fluid-sm bg-surface-secondary border border-border text-content-secondary hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl font-semibold text-fluid-sm bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
