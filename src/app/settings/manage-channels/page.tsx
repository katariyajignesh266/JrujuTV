'use client';

import { useState, useEffect } from 'react';
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
} from '@/lib/api/channels';
import { Channel, ChannelPreview } from '@/types/content';
import { cn } from '@/lib/cn';

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
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});

  // Delete modal state
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load channels on mount
  const loadChannelsList = async () => {
    try {
      setLoadingChannels(true);
      const data = await getChannels();
      setChannels(data);
    } catch (err: any) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (initialized && role === 'parent') {
      loadChannelsList();
    }
  }, [role, initialized]);

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
            Only parents can add, hide, or manage YouTube channels. Please sign in with your parent account to access channel controls.
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
              onClick={() => openAuthModal('parent')}
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

  // Handle Add Channel
  const handleAddChannel = async (previewItem: ChannelPreview) => {
    setIsAdding(true);
    try {
      await addChannel(previewItem);
      setUrlInput('');
      setPreview(null);
      await loadChannelsList();
    } catch (err: any) {
      setFetchError(err.message || 'Failed to add channel.');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Toggle Active (Hide/Unhide)
  const handleToggleActive = async (ch: Channel) => {
    const nextState = !ch.is_active;
    // Optimistic update
    setChannels((prev) =>
      prev.map((c) => (c.id === ch.id ? { ...c, is_active: nextState } : c))
    );
    try {
      await toggleChannelActive(ch.id, nextState);
    } catch (err) {
      console.error('Failed to toggle active state:', err);
      // Revert on error
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, is_active: ch.is_active } : c))
      );
    }
  };

  // Handle Manual Sync
  const handleSync = async (ch: Channel) => {
    setSyncingMap((prev) => ({ ...prev, [ch.id]: true }));
    try {
      await syncChannel(ch.id);
      await loadChannelsList();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncingMap((prev) => ({ ...prev, [ch.id]: false }));
    }
  };

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!channelToDelete) return;
    setIsDeleting(true);
    try {
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
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 -ml-2 rounded-2xl text-content-secondary hover:text-content-primary hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-display text-fluid-xl font-bold text-content-primary flex items-center gap-2.5">
              <Tv2 className="text-brand-primary" size={24} /> Manage YouTube Channels
            </h1>
            <p className="text-fluid-sm text-content-secondary mt-0.5">
              Add YouTube channels for your children. All approved videos will be safely cached.
            </p>
          </div>
        </div>

        {/* ── 1. Paste Link & Fetch Section ── */}
        <div className="rounded-3xl bg-surface-secondary border border-border p-5 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-fluid-base text-content-primary">
            Add a New Channel
          </h2>
          <p className="text-[12px] text-content-secondary leading-relaxed">
            Paste any YouTube channel link (e.g. <span className="font-mono text-content-primary">youtube.com/@handle</span> or <span className="font-mono text-content-primary">youtube.com/channel/UC...</span>).
          </p>

          <form onSubmit={handleFetchDetails} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-secondary pointer-events-none" size={18} />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (fetchError) setFetchError(null);
                }}
                placeholder="https://www.youtube.com/@SuperSimpleSongs"
                className={cn(
                  'w-full h-12 pl-10 pr-4 rounded-2xl text-fluid-sm font-medium',
                  'bg-surface-elevated border border-border text-content-primary',
                  'focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all'
                )}
              />
            </div>

            <button
              type="submit"
              disabled={isFetching || !urlInput.trim()}
              className={cn(
                'h-12 px-6 rounded-2xl font-semibold text-fluid-sm text-white shrink-0',
                'bg-brand-primary hover:bg-brand-primary/90 active:scale-95 shadow-md shadow-brand-primary/20 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
              )}
            >
              {isFetching ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Fetching…</span>
                </>
              ) : (
                <span>Fetch Details</span>
              )}
            </button>
          </form>

          {/* Fetch Error Banner */}
          {fetchError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{fetchError}</span>
            </div>
          )}

          {/* Preview Card */}
          {preview && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-3 duration-200">
              <ChannelPreviewCard
                preview={preview}
                onAdd={handleAddChannel}
                isAdding={isAdding}
              />
            </div>
          )}
        </div>

        {/* ── 2. Added Channels List ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-fluid-lg text-content-primary">
              Your Added Channels ({channels.length})
            </h2>
            <button
              type="button"
              onClick={loadChannelsList}
              disabled={loadingChannels}
              className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-brand-primary transition-colors"
            >
              <RefreshCw size={14} className={cn(loadingChannels && 'animate-spin')} />
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
              <h3 className="font-semibold text-fluid-base text-content-primary">No Channels Added Yet</h3>
              <p className="text-fluid-sm text-content-secondary max-w-sm">
                Paste a YouTube channel link above to begin curating safe videos for your kids.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  variant="admin"
                  onToggleActive={handleToggleActive}
                  onSync={handleSync}
                  onDelete={(c) => setChannelToDelete(c)}
                  isSyncing={syncingMap[ch.id]}
                />
              ))}
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
              Are you sure you want to delete <span className="font-semibold text-content-primary">{channelToDelete.title}</span>?
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
