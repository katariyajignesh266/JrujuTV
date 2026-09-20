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
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map((cat, i) => (
          <li key={cat} className="shrink-0">
            <button
              type="button"
              className={`
                px-3.5 sm:px-4 py-1.5 rounded-full text-[13px] font-medium
                transition-all duration-150 whitespace-nowrap min-touch
                focus-visible:ring-2 focus-visible:ring-brand-primary
                ${i === 0
                  ? 'bg-content-primary text-surface-primary shadow-sm'
                  : 'bg-surface-secondary text-content-secondary hover:bg-surface-elevated hover:text-content-primary border border-border'
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
