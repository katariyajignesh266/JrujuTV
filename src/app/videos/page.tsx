'use client';

import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { PlayCircle } from 'lucide-react';

export default function VideosPage() {
  return (
    <PageShell>
      <div className="flex items-center justify-center min-h-[60dvh]">
        <EmptyState
          icon={PlayCircle}
          title="No Videos Yet"
          description="Videos added by a parent from YouTube links will appear here for your children to watch."
        />
      </div>
    </PageShell>
  );
}
