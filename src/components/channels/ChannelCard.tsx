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
  Shield,
  Sparkles,
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
          'group relative flex flex-col items-center text-center p-5 rounded-3xl overflow-hidden card-shimmer',
          /* Light mode */
          'bg-white/80 border border-white/90',
          'shadow-[0_2px_12px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]',
          /* Dark mode */
          'dark:bg-[#14142A]/80 dark:border-white/[0.06]',
          'dark:shadow-[0_4px_20px_rgba(0,0,0,0.40),inset_0_1px_0_rgba(255,255,255,0.04)]',
          /* Backdrop */
          'backdrop-blur-xl',
          /* Hover */
          'hover:-translate-y-2 hover:shadow-[0_12px_40px_rgba(229,57,53,0.18),0_4px_12px_rgba(0,0,0,0.08)]',
          'dark:hover:shadow-[0_12px_40px_rgba(229,57,53,0.25),0_4px_16px_rgba(0,0,0,0.45)]',
          'hover:border-red-400/30 dark:hover:border-red-500/20',
          'active:scale-[0.97]',
          'transition-all duration-350 ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60'
        )}
      >
        {/* Rich ambient gradient on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.07] via-transparent to-rose-600/[0.05] dark:from-red-500/[0.14] dark:to-rose-500/[0.09]" />
        </div>

        {/* Top shimmer line */}
        <div className="absolute top-0 left-[10%] right-[10%] h-[1.5px] bg-gradient-to-r from-transparent via-red-400/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 rounded-full" />

        {/* Corner decoration */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:rotate-12">
          <Sparkles size={12} className="text-red-400/60" />
        </div>

        {/* Avatar */}
        <div className="relative mt-2 mb-4 z-10">
          {/* Glow ring behind avatar */}
          <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-red-500/30 to-rose-600/20 blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />

          <div className={cn(
            'relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden',
            'border-2 border-neutral-200/80 dark:border-white/[0.08]',
            'shadow-md group-hover:shadow-xl group-hover:shadow-red-500/25',
            'group-hover:scale-[1.07] group-hover:border-red-400/50 dark:group-hover:border-red-400/30',
            'transition-all duration-350',
            'ring-4 ring-transparent group-hover:ring-red-500/10 dark:group-hover:ring-red-500/15'
          )}>
            {channel.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.thumbnail_url}
                alt={channel.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center font-bold text-2xl text-red-500 bg-gradient-to-br from-red-500/12 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20">
                {channel.title.charAt(0)}
              </div>
            )}
          </div>

          {/* Safe badge */}
          <div
            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-2 ring-white dark:ring-[#14142A] z-10 group-hover:scale-110 transition-transform duration-300"
            title="Parent Verified Safe"
          >
            <Shield size={12} strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <h3
          className="relative z-10 font-bold text-[13.5px] sm:text-[14.5px] leading-snug text-[var(--color-text-primary)] line-clamp-2 w-full px-1 tracking-tight group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors duration-200 font-display"
          title={channel.title}
        >
          {channel.title}
        </h3>

        {/* Stats Pills */}
        <div className="relative z-10 flex items-center justify-center gap-1.5 text-[11px] font-semibold mt-3 flex-wrap">
          {channel.video_count > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100/80 dark:bg-white/[0.06] border border-neutral-200/80 dark:border-white/[0.08] text-[var(--color-text-secondary)] backdrop-blur-sm shadow-xs">
              <Play size={9} className="fill-red-500 text-red-500 shrink-0" />
              <span>{formatCompactNumber(channel.video_count)}</span>
            </span>
          )}
          {channel.subscriber_count > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100/80 dark:bg-white/[0.06] border border-neutral-200/80 dark:border-white/[0.08] text-[var(--color-text-secondary)] backdrop-blur-sm shadow-xs">
              <Users size={9} className="text-blue-500 dark:text-blue-400 shrink-0" />
              <span>{formatCompactNumber(channel.subscriber_count)}</span>
            </span>
          )}
        </div>

        {/* View CTA */}
        <div className={cn(
          'relative z-10 mt-4 w-full py-2.5 px-3 rounded-2xl text-xs font-bold',
          'border border-neutral-200/80 dark:border-white/[0.08]',
          'bg-neutral-50/80 dark:bg-white/[0.04] text-[var(--color-text-secondary)]',
          'group-hover:bg-gradient-to-r group-hover:from-red-500 group-hover:to-rose-600',
          'group-hover:text-white group-hover:border-transparent',
          'group-hover:shadow-lg group-hover:shadow-red-500/35',
          'transition-all duration-250 flex items-center justify-center gap-1.5',
          'backdrop-blur-sm'
        )}>
          <span>View Channel</span>
          <ChevronRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </Link>
    );
  }

  // ── Admin / Manage-Channels variant ──────────────────────────────────────────
  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl card-shimmer',
        /* Base */
        'bg-white/75 dark:bg-[#14142A]/70 backdrop-blur-xl',
        'border border-neutral-200/80 dark:border-white/[0.06]',
        'shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.30)]',
        /* Hover */
        'hover:shadow-[0_8px_28px_rgba(229,57,53,0.12),0_2px_8px_rgba(0,0,0,0.06)]',
        'dark:hover:shadow-[0_8px_28px_rgba(229,57,53,0.18),0_2px_12px_rgba(0,0,0,0.40)]',
        'hover:border-red-400/30 dark:hover:border-red-400/20',
        'transition-all duration-250',
        isHidden && 'opacity-55 border-dashed bg-neutral-50/60 dark:bg-white/[0.02]'
      )}
    >
      {/* Left accent bar on hover */}
      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-red-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_8px_rgba(229,57,53,0.6)]" />

      {/* Subtle hover ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-3xl" style={{ background: 'linear-gradient(90deg, rgba(229,57,53,0.04) 0%, transparent 40%)' }} />

      <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto flex-1">
        {/* Avatar */}
        <div className={cn(
          'relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl overflow-hidden shrink-0',
          'bg-neutral-100 dark:bg-white/[0.05]',
          'border border-neutral-200/80 dark:border-white/[0.07]',
          'shadow-sm group-hover:shadow-md group-hover:shadow-red-500/15 group-hover:scale-[1.04]',
          'transition-all duration-250'
        )}>
          {channel.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-lg text-red-500 bg-gradient-to-br from-red-500/10 to-rose-500/10">
              {channel.title.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Title + Status badges */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4
              className="font-bold text-[14.5px] text-[var(--color-text-primary)] truncate max-w-[180px] sm:max-w-[260px] group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors font-display"
              title={channel.title}
            >
              {channel.title}
            </h4>

            {isHidden && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-white/[0.05] text-[var(--color-text-secondary)] border border-neutral-300/80 dark:border-white/[0.07]">
                Hidden
              </span>
            )}

            {(channel.sync_status === 'pending' || channel.sync_status === 'in_progress') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                <Loader2 size={9} className="animate-spin" />
                Importing
              </span>
            )}

            {channel.sync_status === 'complete' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 size={9} />
                Synced
              </span>
            )}
          </div>

          {/* Meta */}
          <p className="text-[11.5px] text-[var(--color-text-secondary)] flex items-center gap-1.5 flex-wrap">
            {(channel.synced_video_count ?? channel.video_count) > 0 && (
              <span className="font-semibold text-[var(--color-text-primary)]">
                {(channel.synced_video_count ?? channel.video_count).toLocaleString()} videos
              </span>
            )}
            {(channel.synced_video_count ?? channel.video_count) > 0 && <span className="opacity-35">·</span>}
            <span>Last synced: {formatRelativeTime(channel.last_synced_at)}</span>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100/80 dark:border-white/[0.05] shrink-0">

        {/* View Channel */}
        <Link
          href={`/channels/${channel.id}`}
          className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center',
            'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            'bg-neutral-100/80 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.07]',
            'hover:border-neutral-300 dark:hover:border-red-500/30 hover:bg-neutral-200/80 dark:hover:bg-red-500/10',
            'hover:shadow-sm dark:hover:shadow-red-500/10',
            'active:scale-95 transition-all duration-150'
          )}
          title="View channel page"
          aria-label="View channel page"
        >
          <ExternalLink size={14} />
        </Link>

        {/* Hide / Unhide */}
        <button
          type="button"
          onClick={() => onToggleActive?.(channel)}
          className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center active:scale-95 transition-all duration-150 border',
            isHidden
              ? 'text-amber-500 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:shadow-sm hover:shadow-amber-500/15'
              : 'text-[var(--color-text-secondary)] bg-neutral-100/80 dark:bg-white/[0.04] border-neutral-200/80 dark:border-white/[0.07] hover:text-[var(--color-text-primary)] hover:border-neutral-300 dark:hover:border-red-500/30 hover:bg-neutral-200/80 dark:hover:bg-red-500/10'
          )}
          title={isHidden ? 'Show channel to children' : 'Hide channel from feeds'}
          aria-label={isHidden ? 'Show channel to children' : 'Hide channel from feeds'}
        >
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        {/* Sync */}
        <button
          type="button"
          onClick={() => onSync?.(channel)}
          disabled={isSyncing}
          className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center',
            'text-[var(--color-text-secondary)] hover:text-red-500 dark:hover:text-red-400',
            'bg-neutral-100/80 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.07]',
            'hover:border-red-400/40 dark:hover:border-red-400/25 hover:bg-red-500/5 dark:hover:bg-red-500/10',
            'hover:shadow-sm hover:shadow-red-500/10',
            'active:scale-95 transition-all duration-150 disabled:opacity-40'
          )}
          title="Refresh videos from YouTube"
          aria-label="Refresh videos from YouTube"
        >
          {isSyncing
            ? <Loader2 size={14} className="animate-spin text-red-500 dark:text-red-400" />
            : <RefreshCw size={14} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete?.(channel)}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-red-500 bg-red-500/8 dark:bg-red-500/10 border border-red-500/20 dark:border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 hover:shadow-sm hover:shadow-red-500/15 active:scale-95 transition-all duration-150"
          title="Delete channel and all videos"
          aria-label="Delete channel"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
