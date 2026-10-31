// src/features/shorts/components/ShortsCaughtUp.tsx
'use client';

import React, { useState } from 'react';
import { CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface ShortsCaughtUpProps {
  onReplay: () => Promise<void>;
}

export function ShortsCaughtUp({ onReplay }: ShortsCaughtUpProps) {
  const { role } = useAuthStore();
  const [replaying, setReplaying] = useState(false);

  const handleReplay = async () => {
    try {
      setReplaying(true);
      await onReplay();
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="relative w-full h-full snap-start snap-always shrink-0 bg-neutral-950 flex items-center justify-center p-6 text-center select-none text-white">
      <div className="max-w-sm space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold font-display">You&apos;re All Caught Up!</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            You have watched all available Shorts from your approved channels. Check back later for new uploads!
          </p>
        </div>

        {role === 'parent' && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleReplay}
              disabled={replaying}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/20 disabled:opacity-50"
            >
              {replaying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              <span>Replay Shorts (Reset My Seen History)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

