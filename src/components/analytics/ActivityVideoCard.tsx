'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import type { ActivityOccurrence } from '@/lib/activity/loadActivityDay';

export function ActivityVideoCard({ occurrence }: { occurrence: ActivityOccurrence }) {
  const router = useRouter();
  const { card, at } = occurrence;
  const [failedImage, setFailedImage] = useState('');
  const pct = card?.percent;
  const progress = pct == null ? 'Progress unavailable' : 'Latest · ' +
    (pct >= 95 ? 'Completed' : pct <= 2 ? 'Just started' : pct + '% watched');
  return (
    <button type="button" disabled={!card}
      onClick={() => card && router.push('/videos/' + encodeURIComponent(card.target) + '?resume=' + Math.floor(card.resume))}
      className="flex w-full min-w-0 items-start gap-2.5 rounded-xl border border-border bg-surface-secondary p-2.5 text-left enabled:hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
      <span className="relative grid aspect-video w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-elevated sm:w-24">
        {card?.thumbnail && card.thumbnail !== failedImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.thumbnail} alt="" loading="lazy" onError={() => setFailedImage(card.thumbnail)}
            className="absolute inset-0 h-full w-full object-cover" />
        ) : <PlayCircle aria-hidden size={20} className="text-content-secondary" />}
        {pct != null && pct > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
          <span className="block h-full bg-red-600" style={{ width: pct + '%' }} />
        </span>}
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block break-words text-sm font-semibold leading-snug text-content-primary">{card ? card.title || 'Untitled video' : 'Video unavailable'}</span>
        {card && <span className="block break-words text-xs text-content-secondary">{card.channel || 'Channel unavailable'}</span>}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-secondary">
          <span>{formatRelativeTime(at)}</span>
          {card && <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5">{progress}</span>}
        </span>
      </span>
    </button>
  );
}
