'use client';

import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Heart } from 'lucide-react';

export default function BhaktiPage() {
  return (
    <PageShell>
      <div className="flex items-center justify-center min-h-[60dvh]">
        <EmptyState
          icon={Heart}
          title="My Bhakti Journey"
          description="Track your spiritual learning journey. Your watched devotional content and progress will appear here."
        />
      </div>
    </PageShell>
  );
}
