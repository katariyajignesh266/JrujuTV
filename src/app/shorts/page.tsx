// src/app/shorts/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { ShortsLoading, ShortsStage } from '@/features/shorts/components/ShortsStage';

const ShortsContainer = dynamic(
  () => import('@/features/shorts/components/ShortsContainer').then((m) => m.ShortsContainer),
  {
    ssr: false,
    loading: () => (
      <ShortsStage><ShortsLoading /></ShortsStage>
    ),
  }
);

export default function ShortsPage() {
  return <ShortsContainer />;
}
