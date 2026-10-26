// src/store/videoStore.ts
import { create } from 'zustand';
import { Video } from '@/types/content';

export type PlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';

interface VideoStoreState {
  currentVideo: Video | null;
  playerState: PlayerState;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  showControls: boolean;

  setCurrentVideo: (video: Video | null) => void;
  setPlayerState: (state: PlayerState) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  setShowControls: (show: boolean) => void;
}

export const useVideoStore = create<VideoStoreState>((set) => ({
  currentVideo: null,
  playerState: 'unstarted',
  currentTime: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  isFullscreen: false,
  showControls: true,

  setCurrentVideo: (video) => set({ currentVideo: video }),
  setPlayerState: (playerState) => set({ playerState }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setShowControls: (showControls) => set({ showControls }),
}));
