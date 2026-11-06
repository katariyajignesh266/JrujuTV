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
}

export const useShortsFeatureStore = create<ShortsStoreState>((set) => ({
  isMuted: true,
  setMuted: (muted) => set({ isMuted: muted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  hasUserGestureUnlocked: false,
  setGestureUnlocked: (unlocked) => set({ hasUserGestureUnlocked: unlocked, isMuted: !unlocked }),

  activeIndex: 0,
  setActiveIndex: (index) => set({ activeIndex: index }),
}));
