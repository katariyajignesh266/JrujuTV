'use client';

import Link from 'next/link';
import {
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Play,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Channel } from '@/types/content';
import { cn } from '@/lib/cn';
import { formatCompactNumber, formatRelativeTime } from '@/lib/formatters';

interface ChannelCardProps {
  channel: Channel;
  variant?: 'public' | 'admin';
  onToggleActive?: (channel: Channel) => void;
  onSync?: (channel: Channel) => void;
  onDelete?: (channel: Channel) => void;
  isSyncing?: boolean;
}

export function ChannelCard({
  channel,
  variant = 'public',
  onToggleActive,
  onSync,
  onDelete,
  isSyncing,
}: ChannelCardProps) {
  const isHidden = !channel.is_active;

  if (variant === 'public') {
    return (
      <Link
        href={`/channels/${channel.id}`}
        className={cn(
          'group relative flex flex-col items-center text-center p-4 sm:p-5 rounded-3xl overflow-hidden',
          'bg-surface-secondary/70 backdrop-blur-xl border border-border/80',
          'hover:border-brand-primary/40 hover:shadow-xl hover:shadow-brand-primary/10 hover:-translate-y-1',
          'active:scale-[0.98] transition-all duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary'
        )}
      >
        {/* Subtle decorative top glow gradient */}
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-brand-primary/12 via-brand-secondary/5 to-transparent pointer-events-none group-hover:from-brand-primary/20 transition-all duration-300" />

        {/* Channel Avatar with layered glow and verified tick */}
        <div className="relative mt-1 mb-3">
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden bg-surface-elevated border-2 border-white/80 dark:border-white/10 shadow-md group-hover:shadow-lg group-hover:scale-105 group-hover:border-brand-primary/50 transition-all duration-300 ring-4 ring-brand-primary/10">
            {channel.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.thumbnail_url}
                alt={channel.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center font-bold text-2xl text-brand-primary bg-brand-primary/10">
                {channel.title.charAt(0)}
              </div>
            )}
          </div>

          {/* Kid-safe verified badge */}
          <div
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md ring-2 ring-surface-secondary"
            title="Parent Verified Safe"
          >
            <CheckCircle2 size={13} strokeWidth={2.5} />
          </div>
        </div>

        {/* Channel Title */}
        <h3
          className="font-display font-bold text-fluid-base text-content-primary line-clamp-1 w-full px-1 tracking-tight group-hover:text-brand-primary transition-colors"
          title={channel.title}
        >
          {channel.title}
        </h3>

        {/* Stats Pills */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-content-secondary mt-1.5 flex-wrap">
          {channel.video_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border/60 text-content-secondary group-hover:border-border transition-colors">
              <Play size={10} className="fill-brand-primary/20 text-brand-primary shrink-0" />
              <span>{formatCompactNumber(channel.video_count)} videos</span>
            </span>
          )}
          {channel.subscriber_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border/60 text-content-secondary group-hover:border-border transition-colors">
              <Users size={10} className="text-brand-secondary shrink-0" />
              <span>{formatCompactNumber(channel.subscriber_count)}</span>
            </span>
          )}
        </div>

        {/* View Channel Button */}
        <div className="mt-4 w-full py-2 px-3 rounded-2xl text-xs font-bold text-content-primary bg-surface-elevated border border-border/80 group-hover:bg-gradient-to-r group-hover:from-brand-primary group-hover:to-brand-secondary group-hover:text-white group-hover:border-transparent group-hover:shadow-md group-hover:shadow-brand-primary/20 transition-all duration-200 flex items-center justify-center gap-1">
          <span>View Channel</span>
          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>
    );
  }

  // Admin variant (for Manage Channels screen)
  return (
    <div
      className={cn(
        'w-full max-w-full overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl',
        'bg-surface-secondary/70 backdrop-blur-md border border-border/80 shadow-sm',
        'hover:border-brand-primary/30 hover:shadow-md transition-all duration-200 group',
        isHidden && 'opacity-65 bg-surface-secondary/40 border-dashed'
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto flex-1">
        <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl overflow-hidden bg-surface-elevated border border-border/80 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
          {channel.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-lg text-brand-primary bg-brand-primary/10">
              {channel.title.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4
              className="font-bold text-fluid-base text-content-primary truncate max-w-[200px] sm:max-w-[280px]"
              title={channel.title}
            >
              {channel.title}
            </h4>
            {isHidden && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                Hidden
              </span>
            )}
            {(channel.sync_status === 'pending' || channel.sync_status === 'in_progress') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                <Loader2 size={10} className="animate-spin" />
                Importing
              </span>
            )}
            {channel.sync_status === 'complete' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-sm">
                <CheckCircle2 size={10} className="text-emerald-500" />
                Synced
              </span>
            )}
          </div>

          <p className="text-[12px] text-content-secondary flex items-center gap-1.5 flex-wrap">
            {(channel.synced_video_count ?? channel.video_count) > 0 && (
              <span className="font-medium text-content-primary">
                {(channel.synced_video_count ?? channel.video_count).toLocaleString()} videos
              </span>
            )}
            {(channel.synced_video_count ?? channel.video_count) > 0 && <span>·</span>}
            <span>Last synced: {formatRelativeTime(channel.last_synced_at)}</span>
          </p>
        </div>
      </div>

      {/* Admin Action Buttons */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
        {/* View Channel Page */}
        <Link
          href={`/channels/${channel.id}`}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-content-secondary hover:text-content-primary bg-surface-elevated border border-border/60 hover:border-brand-primary/40 active:scale-95 transition-all shadow-xs"
          title="View channel page"
          aria-label="View channel page"
        >
          <ExternalLink size={16} />
        </Link>

        {/* Hide / Unhide Toggle */}
        <button
          type="button"
          onClick={() => onToggleActive?.(channel)}
          className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center active:scale-95 transition-all border shadow-xs',
            isHidden
              ? 'text-amber-500 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
              : 'text-content-secondary hover:text-content-primary bg-surface-elevated border-border/60 hover:border-brand-primary/40'
          )}
          title={isHidden ? 'Show channel to children' : 'Hide channel from feeds'}
          aria-label={isHidden ? 'Show channel to children' : 'Hide channel from feeds'}
        >
          {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        {/* Manual Sync / Refresh */}
        <button
          type="button"
          onClick={() => onSync?.(channel)}
          disabled={isSyncing}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-content-secondary hover:text-brand-primary bg-surface-elevated border border-border/60 hover:border-brand-primary/40 active:scale-95 transition-all disabled:opacity-50 shadow-xs"
          title="Refresh videos from YouTube"
          aria-label="Refresh videos from YouTube"
        >
          {isSyncing ? <Loader2 size={16} className="animate-spin text-brand-primary" /> : <RefreshCw size={16} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete?.(channel)}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-red-500 hover:text-red-600 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all shadow-xs"
          title="Delete channel and all videos"
          aria-label="Delete channel"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
