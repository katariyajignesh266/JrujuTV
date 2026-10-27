'use client';

import Link from 'next/link';
import { Eye, EyeOff, RefreshCw, Trash2, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
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
          'group flex flex-col items-center text-center p-5 rounded-3xl bg-surface-secondary border border-border/60',
          'transition-all duration-200 hover:scale-[1.02] hover:border-brand-primary/40 hover:shadow-lg',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary'
        )}
      >
        <div className="relative h-24 w-24 rounded-full overflow-hidden bg-surface-elevated border-2 border-brand-primary/20 shadow-md mb-3 group-hover:border-brand-primary transition-colors">
          {channel.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-2xl text-brand-primary">
              {channel.title.charAt(0)}
            </div>
          )}
        </div>

        <h3 className="font-display font-bold text-fluid-base text-content-primary line-clamp-1 w-full">
          {channel.title}
        </h3>

        <div className="flex items-center gap-1.5 text-[12px] text-content-secondary mt-1">
          {channel.video_count > 0 && <span>{formatCompactNumber(channel.video_count)} videos</span>}
          {channel.subscriber_count > 0 && <span>· {formatCompactNumber(channel.subscriber_count)} subs</span>}
        </div>

        <div className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-elevated border border-border text-content-primary group-hover:bg-brand-primary group-hover:text-white transition-all">
          View Channel
        </div>
      </Link>
    );
  }

  // Admin variant (for Manage Channels screen)
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-surface-secondary border border-border',
        'transition-all duration-200',
        isHidden && 'opacity-60 bg-surface-secondary/50'
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative h-14 w-14 rounded-full overflow-hidden bg-surface-elevated border border-border shrink-0">
          {channel.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-lg text-brand-primary">
              {channel.title.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-fluid-base text-content-primary truncate">
              {channel.title}
            </h4>
            {isHidden && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                Hidden
              </span>
            )}
            {(channel.sync_status === 'pending' || channel.sync_status === 'in_progress') && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Loader2 size={9} className="animate-spin" />
                Importing
              </span>
            )}
            {channel.sync_status === 'complete' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={9} />
                Synced
              </span>
            )}
          </div>
          <p className="text-[12px] text-content-secondary">
            {(channel.synced_video_count ?? channel.video_count) > 0 &&
              `${(channel.synced_video_count ?? channel.video_count).toLocaleString()} videos · `}
            Last synced: {formatRelativeTime(channel.last_synced_at)}
          </p>
        </div>
      </div>

      {/* Admin Action Buttons */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
        {/* View Page */}
        <Link
          href={`/channels/${channel.id}`}
          className="p-2 rounded-xl text-content-secondary hover:text-content-primary hover:bg-surface-elevated transition-colors"
          title="View channel page"
        >
          <ExternalLink size={18} />
        </Link>

        {/* Hide / Unhide */}
        <button
          type="button"
          onClick={() => onToggleActive?.(channel)}
          className={cn(
            'p-2 rounded-xl transition-colors',
            isHidden
              ? 'text-amber-500 hover:bg-amber-500/10'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
          )}
          title={isHidden ? 'Show channel to children' : 'Hide channel from feeds'}
        >
          {isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>

        {/* Manual Refresh / Sync */}
        <button
          type="button"
          onClick={() => onSync?.(channel)}
          disabled={isSyncing}
          className="p-2 rounded-xl text-content-secondary hover:text-brand-primary hover:bg-brand-primary/10 transition-colors disabled:opacity-50"
          title="Refresh videos from YouTube"
        >
          {isSyncing ? <Loader2 size={18} className="animate-spin text-brand-primary" /> : <RefreshCw size={18} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete?.(channel)}
          className="p-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Delete channel and all videos"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
