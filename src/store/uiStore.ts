// src/store/uiStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Active navigation tab
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Sidebar (desktop)
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Search overlay (mobile)
  searchOpen: boolean;
  toggleSearch: () => void;
  closeSearch: () => void;

  // Notification panel
  notifOpen: boolean;
  toggleNotif: () => void;
  closeNotif: () => void;

  // Auth modal
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Theme — default light, persisted
      theme: 'light',
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),

      // Active tab
      activeTab: '/',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Sidebar
      sidebarOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Search
      searchOpen: false,
      toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
      closeSearch: () => set({ searchOpen: false }),

      // Notifications
      notifOpen: false,
      toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen })),
      closeNotif: () => set({ notifOpen: false }),

      // Auth modal
      authModalOpen: false,
      openAuthModal: () => set({ authModalOpen: true }),
      closeAuthModal: () => set({ authModalOpen: false }),
    }),
    {
      name: 'jruju-ui',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

