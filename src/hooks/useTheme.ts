'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setThemeStore = useUIStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDarkClass = document.documentElement.classList.contains('dark');
    if (theme === 'dark' && !isDarkClass) {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light' && isDarkClass) {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    setThemeStore(nextTheme);
  }, [theme, setThemeStore]);

  const setTheme = useCallback(
    (newTheme: 'light' | 'dark') => {
      if (typeof document !== 'undefined') {
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      setThemeStore(newTheme);
    },
    [setThemeStore]
  );

  const isDark = theme === 'dark';

  return { theme, toggleTheme, setTheme, isDark, mounted };
}
