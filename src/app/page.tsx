'use client';

import { PageShell } from '@/components/layout/PageShell';
import { VideoCard } from '@/components/cards/VideoCard';
import { House } from 'lucide-react';

export default function HomePage() {
  return (
    <PageShell>
      {/* Category chip bar */}
      <CategoryChips />

      {/* Video card grid */}
      <section aria-label="Videos feed" className="mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 gap-y-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <VideoCard key={i} skeleton />
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function CategoryChips() {
  const categories = ['All', 'Bhajans', 'Stories', 'Education', 'Cartoons', 'Nature', 'Festivals', 'Yoga'];
  return (
    <nav aria-label="Content categories" className="relative">
      <ul
        role="list"
        className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map((cat, i) => (
          <li key={cat} className="shrink-0">
            <button
              type="button"
              className={`
                px-3 py-1 rounded-full text-[11.5px] font-medium
                transition-all duration-200 whitespace-nowrap
                focus-visible:ring-2 focus-visible:ring-brand-primary
                ${i === 0
                  ? [
                      'bg-content-primary text-surface-primary',
                      'shadow-sm',
                    ].join(' ')
                  : [
                      'bg-neutral-900/5 dark:bg-white/5 backdrop-blur-sm',
                      'border border-neutral-900/10 dark:border-white/10',
                      'text-content-secondary',
                      'hover:bg-neutral-900/10 dark:hover:bg-white/10 hover:text-content-primary',
                      'hover:border-neutral-900/20 dark:hover:border-white/20',
                    ].join(' ')
                }
              `}
              aria-pressed={i === 0}
            >
              {cat}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
