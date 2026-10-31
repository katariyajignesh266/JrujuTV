// src/features/shorts/components/ShortsEmptyState.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, Plus } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuthStore } from '@/store/authStore';

export function ShortsEmptyState() {
  const { role } = useAuthStore();

  return (
    <div className="flex items-center justify-center w-full h-full px-4 text-center">
      <div className="max-w-md w-full space-y-4">
        <EmptyState
          icon={Zap}
          title={role === 'parent' ? 'No Shorts in Your Library' : 'No Shorts Available'}
          description={
            role === 'parent'
              ? 'Shorts are videos under 2 minutes. Enable Shorts for your approved channels in Manage Channels!'
              : 'Check back soon for fun short videos from your approved channels!'
          }
        />
        {role === 'parent' && (
          <div className="pt-2">
            <Link
              href="/settings/manage-channels"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-95 transition-all"
            >
              <Plus size={16} />
              <span>Manage Channels</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

