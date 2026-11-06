// src/app/shorts/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ShortsContainer = dynamic(
  () => import('@/features/shorts/components/ShortsContainer').then((m) => m.ShortsContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center w-full h-[calc(100dvh-58px)] bg-black text-white space-y-3">
        <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
        <p className="text-sm font-medium text-neutral-400">Loading shorts…</p>
      </div>
    ),
  }
);

export default function ShortsPage() {
  return <ShortsContainer />;
}
