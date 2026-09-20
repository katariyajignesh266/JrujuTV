// src/hooks/useTheme.ts
'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' };
}

