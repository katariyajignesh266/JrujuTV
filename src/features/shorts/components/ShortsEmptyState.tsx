// src/features/shorts/components/ShortsEmptyState.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, Plus, RotateCcw } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuthStore } from '@/store/authStore';

interface ShortsEmptyStateProps {
  onReplay?: () => void;
}

export function ShortsEmptyState({ onReplay }: ShortsEmptyStateProps) {
  const { role } = useAuthStore();

  return (
    <div className="flex items-center justify-center w-full h-full px-4 text-center">
      <div className="max-w-md w-full space-y-4">
        <EmptyState
          icon={Zap}
          title={role === 'parent' ? 'No Shorts in Your Library' : 'No Shorts Available'}
          description={
            role === 'parent'
              ? 'Enable Shorts for your approved channels in Manage Channels, or reset watch history if all available shorts have been watched!'
              : 'You have watched all available Shorts! Check back soon for new videos from your approved channels.'
          }
        />
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/20"
            >
              <RotateCcw size={15} />
              <span>Watch Again (Reset History)</span>
            </button>
          )}
          {role === 'parent' && (
            <Link
              href="/settings/manage-channels"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>Manage Channels</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
