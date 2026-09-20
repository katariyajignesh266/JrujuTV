'use client';

import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tv2 } from 'lucide-react';

export default function ChannelsPage() {
  return (
    <PageShell>
      <div className="flex items-center justify-center min-h-[60dvh]">
        <EmptyState
          icon={Tv2}
          title="No Channels Added"
          description="Parents can add YouTube channels by pasting a channel link. All approved content will appear here."
        />
      </div>
    </PageShell>
  );
}
