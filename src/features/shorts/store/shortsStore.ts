// src/features/shorts/store/shortsStore.ts
'use client';

import { create } from 'zustand';

interface ShortsStoreState {
  // Session audio state: starts muted for browser autoplay policy compliance
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;

  // Once user taps anywhere, audio is unlocked and subsequent shorts autoplay with sound
  hasUserGestureUnlocked: boolean;
  setGestureUnlocked: (unlocked: boolean) => void;

  // Active item tracking
  activeIndex: number;
  setActiveIndex: (index: number) => void;

  // Session-level unplayable blacklist (immediately pruned without waiting for DB migration)
  unplayableVideoIds: Set<string>;
  markVideoUnplayable: (idOrYoutubeId: string) => void;
}

export const useShortsFeatureStore = create<ShortsStoreState>((set) => ({
  isMuted: true,
  setMuted: (muted) => set({ isMuted: muted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  hasUserGestureUnlocked: false,
  setGestureUnlocked: (unlocked) => set({ hasUserGestureUnlocked: unlocked, isMuted: !unlocked }),

  activeIndex: 0,
  setActiveIndex: (index) => set({ activeIndex: index }),

  unplayableVideoIds: new Set<string>(),
  markVideoUnplayable: (idOrYoutubeId: string) =>
    set((state) => {
      const next = new Set(state.unplayableVideoIds);
      next.add(idOrYoutubeId);
      return { unplayableVideoIds: next };
    }),
}));
