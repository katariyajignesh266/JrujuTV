// src/store/authStore.ts
'use client';

import { create } from 'zustand';
import type { Role, User } from '@/types/auth';

interface AuthState {
  role: Role;
  user: User | null;

  // UI-only mock actions — no real auth
  loginAsParent: () => void;
  loginAsChild: (name: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  role: 'guest',
  user: null,

  loginAsParent: () =>
    set({
      role: 'parent',
      user: { id: 'parent-1', name: 'Parent User', role: 'parent' },
    }),

  loginAsChild: (name: string) =>
    set({
      role: 'child',
      user: { id: 'child-1', name, role: 'child' },
    }),

  logout: () => set({ role: 'guest', user: null }),
}));

