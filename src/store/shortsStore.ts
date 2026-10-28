// src/store/shortsStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ShortsState {
  // Watched video IDs for feed exclusion
  watchedIds: string[];
  markWatched: (videoId: string) => void;
  clearWatchedHistory: () => void;

  // Liked video IDs
  likedIds: string[];
  toggleLike: (videoId: string) => void;
  isLiked: (videoId: string) => boolean;

  // Global sound state across all shorts
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;

  // Comments sheet state
  commentsOpen: boolean;
  activeCommentVideoId: string | null;
  openComments: (videoId: string) => void;
  closeComments: () => void;
}

export const useShortsStore = create<ShortsState>()(
  persist(
    (set, get) => ({
      watchedIds: [],
      markWatched: (videoId: string) => {
        if (!videoId) return;
        set((state) => {
          if (state.watchedIds.includes(videoId)) return state;
          // Keep up to 200 most recent watched shorts
          const updated = [...state.watchedIds, videoId].slice(-200);
          return { watchedIds: updated };
        });
      },
      clearWatchedHistory: () => set({ watchedIds: [] }),

      likedIds: [],
      toggleLike: (videoId: string) => {
        if (!videoId) return;
        set((state) => {
          const exists = state.likedIds.includes(videoId);
          const updated = exists
            ? state.likedIds.filter((id) => id !== videoId)
            : [...state.likedIds, videoId];
          return { likedIds: updated };
        });
      },
      isLiked: (videoId: string) => {
        return get().likedIds.includes(videoId);
      },

      // Default unmuted or muted based on browser autoplay policies
      isMuted: false,
      setMuted: (muted: boolean) => set({ isMuted: muted }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      commentsOpen: false,
      activeCommentVideoId: null,
      openComments: (videoId: string) =>
        set({ commentsOpen: true, activeCommentVideoId: videoId }),
      closeComments: () =>
        set({ commentsOpen: false, activeCommentVideoId: null }),
    }),
    {
      name: 'jruju-shorts-v2',
      partialize: (state) => ({
        watchedIds: state.watchedIds,
        likedIds: state.likedIds,
        isMuted: state.isMuted,
      }),
    }
  )
);
