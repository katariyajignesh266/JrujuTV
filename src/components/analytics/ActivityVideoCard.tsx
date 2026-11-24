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
  const completed = pct != null && pct >= 95;
  const partial = pct != null && pct > 2 && !completed;
  const progress = completed ? '✓ Completed' : partial ? pct + '% watched' :
    pct == null ? 'Progress unavailable' : 'Just started';
  const badgeColor = completed
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    : partial
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
      : 'border-border bg-white text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
  return (
    <button type="button" disabled={!card}
      onClick={() => card && router.push('/videos/' + encodeURIComponent(card.target) + '?resume=' + Math.floor(card.resume))}
      className="grid w-full min-w-0 grid-cols-[clamp(5rem,32%,7rem)_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1.5 rounded-2xl border border-border bg-neutral-50 p-2.5 pr-3 dark:bg-neutral-800 text-left enabled:hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
      <span className="relative row-span-2 grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-surface-elevated">
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
        <span className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-content-primary">{card ? card.title || 'Untitled video' : 'Video unavailable'}</span>
        {card && <span className="block truncate text-[11px] text-content-secondary">{card.channel || 'Channel unavailable'}</span>}
      </span>
      <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap text-[10px] leading-tight text-content-secondary">
        <span>{formatRelativeTime(at)}</span>
        {card && <span title="Most recently saved video progress"
          className={'rounded-full border px-1.5 py-0.5 font-semibold ' + badgeColor}>{progress}</span>}
      </span>
    </button>
  );
}
