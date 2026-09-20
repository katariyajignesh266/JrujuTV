'use client';

import { cn } from '@/lib/cn';
import { Tv2 } from 'lucide-react';

interface ChannelCardProps {
  name?: string;
  avatarUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  skeleton?: boolean;
}

export function ChannelCard({ name, avatarUrl, subscriberCount, videoCount, skeleton }: ChannelCardProps) {
  const isLoading = skeleton || !name;

  return (
    <article
      className={cn(
        'flex flex-col items-center gap-3 p-5 rounded-2xl',
        'bg-surface-secondary border border-border',
        'hover:shadow-md hover:border-brand-primary/30',
        'transition-all duration-200 cursor-pointer group'
      )}
      aria-label={isLoading ? 'Loading channel' : `Channel: ${name}`}
    >
      {/* Avatar */}
      <div
        className={cn(
          'h-16 w-16 rounded-full flex items-center justify-center',
          'bg-surface-elevated overflow-hidden',
          isLoading ? 'animate-pulse' : 'border-2 border-border group-hover:border-brand-primary/40 transition-colors'
        )}
        aria-hidden="true"
      >
        {!isLoading && !avatarUrl && (
          <Tv2 size={28} strokeWidth={1.5} className="text-content-disabled" />
        )}
        {avatarUrl && !isLoading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>

      {/* Name */}
      <div className={cn('w-full text-center space-y-1')}>
        {isLoading ? (
          <>
            <div className="animate-pulse rounded h-4 bg-surface-elevated w-3/4 mx-auto" />
            <div className="animate-pulse rounded h-3 bg-surface-elevated w-1/2 mx-auto" />
          </>
        ) : (
          <>
            <p className="font-semibold text-fluid-sm text-content-primary truncate">{name}</p>
            <p className="text-[11px] text-content-secondary">
              {subscriberCount?.toLocaleString()} subscribers · {videoCount} videos
            </p>
          </>
        )}
      </div>

      {/* Subscribe CTA */}
      {!isLoading && (
        <button
          type="button"
          className={cn(
            'px-4 py-1.5 rounded-full text-[12px] font-semibold',
            'bg-brand-primary text-white',
            'hover:opacity-90 active:scale-95 transition-all duration-150',
            'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2'
          )}
        >
          Subscribe
        </button>
      )}
    </article>
  );
}

