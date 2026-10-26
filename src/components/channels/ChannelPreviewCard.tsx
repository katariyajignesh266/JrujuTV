'use client';

import { CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { ChannelPreview } from '@/types/content';
import { cn } from '@/lib/cn';

interface ChannelPreviewCardProps {
  preview: ChannelPreview;
  onAdd: (preview: ChannelPreview) => void;
  isAdding: boolean;
}

export function ChannelPreviewCard({ preview, onAdd, isAdding }: ChannelPreviewCardProps) {
  return (
    <div className="rounded-3xl bg-surface-secondary border border-border p-5 sm:p-6 shadow-sm transition-all duration-200">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Channel Avatar */}
        <div className="h-20 w-20 rounded-full overflow-hidden bg-surface-elevated shrink-0 border-2 border-brand-primary/30 shadow-md">
          {preview.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.thumbnail_url} alt={preview.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-bold text-xl text-brand-primary">
              {preview.title.charAt(0)}
            </div>
          )}
        </div>

        {/* Channel Details */}
        <div className="flex-1 text-center sm:text-left min-w-0 space-y-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h3 className="font-display font-bold text-fluid-base text-content-primary truncate">
              {preview.title}
            </h3>
            {preview.already_added && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 size={12} /> Already Added
              </span>
            )}
          </div>

          <p className="text-[12px] text-content-secondary">
            {preview.subscriber_count > 0 && `${preview.subscriber_count.toLocaleString()} subscribers`}
            {preview.subscriber_count > 0 && preview.video_count > 0 && ' · '}
            {preview.video_count > 0 && `${preview.video_count.toLocaleString()} videos`}
          </p>

          <p className="text-[11.5px] text-content-secondary/80 pt-1">
            Uploads Playlist: <span className="font-mono text-[11px]">{preview.uploads_playlist_id}</span>
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-2 sm:mt-0 shrink-0">
          {preview.already_added ? (
            <div className="px-4 py-2.5 rounded-2xl bg-surface-elevated border border-border text-fluid-sm font-semibold text-content-secondary text-center">
              Channel Added
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAdd(preview)}
              disabled={isAdding}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold text-white shadow-lg shadow-brand-primary/20',
                'bg-brand-primary hover:bg-brand-primary/90 active:scale-95 transition-all duration-150',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              {isAdding ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Adding &amp; Syncing…</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Add This Channel</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
