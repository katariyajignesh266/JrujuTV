'use client';

import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Zap } from 'lucide-react';

export default function ShortsPage() {
  return (
    <PageShell>
      <div className="flex items-center justify-center min-h-[60dvh]">
        <EmptyState
          icon={Zap}
          title="Shorts Coming Soon"
          description="Short-form devotional videos will appear here. A parent can curate them from connected channels."
        />
      </div>
    </PageShell>
  );
}
