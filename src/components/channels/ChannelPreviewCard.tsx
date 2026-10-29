'use client';

import { CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { ChannelPreview } from '@/types/content';
import { cn } from '@/lib/cn';
import { formatCompactNumber } from '@/lib/formatters';

interface ChannelPreviewCardProps {
  preview: ChannelPreview;
  onAdd: (preview: ChannelPreview) => void;
  isAdding: boolean;
}

export function ChannelPreviewCard({ preview, onAdd, isAdding }: ChannelPreviewCardProps) {
  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-3xl bg-surface-elevated border-2 border-brand-primary/30 p-5 sm:p-6 shadow-xl shadow-brand-primary/5 transition-all duration-300 animate-in fade-in zoom-in-95">
      {/* Decorative top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-tertiary" />

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pt-1">
        {/* Channel Avatar with glowing halo */}
        <div className="relative h-20 w-20 sm:h-22 sm:w-22 rounded-2xl overflow-hidden bg-surface-secondary shrink-0 border-2 border-brand-primary/40 shadow-lg ring-4 ring-brand-primary/10">
          {preview.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.thumbnail_url} alt={preview.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-2xl text-brand-primary bg-brand-primary/10">
              {preview.title.charAt(0)}
            </div>
          )}
        </div>

        {/* Channel Details */}
        <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h3
              className="font-display font-bold text-fluid-lg text-content-primary truncate max-w-full"
              title={preview.title}
            >
              {preview.title}
            </h3>
            {preview.already_added && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-xs">
                <CheckCircle2 size={13} className="text-emerald-500" /> Already in Library
              </span>
            )}
          </div>

          {/* Quick stats badges */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {preview.subscriber_count > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium bg-surface-secondary border border-border text-content-secondary">
                <span className="font-semibold text-content-primary mr-1">
                  {formatCompactNumber(preview.subscriber_count)}
                </span>{' '}
                subscribers
              </span>
            )}
            {preview.video_count > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium bg-surface-secondary border border-border text-content-secondary">
                <span className="font-semibold text-content-primary mr-1">
                  {formatCompactNumber(preview.video_count)}
                </span>{' '}
                videos available
              </span>
            )}
          </div>

          <p className="text-[11.5px] text-content-secondary/80 truncate max-w-full">
            Playlist ID: <span className="font-mono text-content-primary bg-surface-secondary px-1.5 py-0.5 rounded-md border border-border/50 text-[11px]">{preview.uploads_playlist_id}</span>
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-2 sm:mt-0 shrink-0 w-full sm:w-auto flex justify-center">
          {preview.already_added ? (
            <div className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-surface-secondary border border-border text-fluid-sm font-semibold text-content-secondary text-center select-none">
              ✓ Channel Already Added
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAdd(preview)}
              disabled={isAdding}
              className={cn(
                'w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-fluid-sm font-bold text-white',
                'bg-gradient-to-r from-brand-primary via-red-600 to-brand-secondary shadow-lg shadow-brand-primary/25',
                'hover:shadow-brand-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none'
              )}
            >
              {isAdding ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Adding &amp; Syncing…</span>
                </>
              ) : (
                <>
                  <Plus size={18} strokeWidth={2.5} />
                  <span>Add Channel to Library</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
