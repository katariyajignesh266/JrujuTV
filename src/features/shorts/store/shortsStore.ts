// src/features/shorts/store/shortsStore.ts
'use client';

import { create } from 'zustand';
import { ShortVideo } from '../types';

interface ShortsStoreState {
  // Session audio state: starts muted for browser autoplay policy, remembers unmute choice
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;

  // Active item tracking
  activeIndex: number;
  setActiveIndex: (index: number) => void;

  // Comments modal state
  commentsOpen: boolean;
  activeCommentVideo: ShortVideo | null;
  openComments: (video: ShortVideo) => void;
  closeComments: () => void;

  // Optimistic engagement states
  likedMap: Record<string, boolean>;
  likeCountMap: Record<string, number>;
  savedMap: Record<string, boolean>;
  initEngagement: (videos: ShortVideo[]) => void;
  setOptimisticLike: (videoId: string, isLiked: boolean, countDelta: number) => void;
  setOptimisticSave: (videoId: string, isSaved: boolean) => void;
}

export const useShortsFeatureStore = create<ShortsStoreState>((set) => ({
  // Default muted to guarantee seamless autoplay across iOS Safari and Android Chrome
  isMuted: true,
  setMuted: (muted) => set({ isMuted: muted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  activeIndex: 0,
  setActiveIndex: (index) => set({ activeIndex: index }),

  commentsOpen: false,
  activeCommentVideo: null,
  openComments: (video) => set({ commentsOpen: true, activeCommentVideo: video }),
  closeComments: () => set({ commentsOpen: false, activeCommentVideo: null }),

  likedMap: {},
  likeCountMap: {},
  savedMap: {},

  initEngagement: (videos) =>
    set((state) => {
      const nextLiked = { ...state.likedMap };
      const nextCounts = { ...state.likeCountMap };
      const nextSaved = { ...state.savedMap };

      for (const v of videos) {
        if (nextLiked[v.id] === undefined) {
          nextLiked[v.id] = v.is_liked;
        }
        if (nextCounts[v.id] === undefined) {
          nextCounts[v.id] = v.family_like_count ?? 0;
        }
        if (nextSaved[v.id] === undefined) {
          nextSaved[v.id] = v.is_saved;
        }
      }

      return {
        likedMap: nextLiked,
        likeCountMap: nextCounts,
        savedMap: nextSaved,
      };
    }),

  setOptimisticLike: (videoId, isLiked, countDelta) =>
    set((state) => ({
      likedMap: { ...state.likedMap, [videoId]: isLiked },
      likeCountMap: {
        ...state.likeCountMap,
        [videoId]: Math.max(0, (state.likeCountMap[videoId] ?? 0) + countDelta),
      },
    })),

  setOptimisticSave: (videoId, isSaved) =>
    set((state) => ({
      savedMap: { ...state.savedMap, [videoId]: isSaved },
    })),
}));

