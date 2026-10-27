'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';

function syncThemeColorMeta(isDark: boolean) {
  if (typeof document === 'undefined') return;
  const color = isDark ? '#0F0F0F' : '#FFFFFF';
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length > 0) {
    metas.forEach((meta) => {
      meta.setAttribute('content', color);
    });
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  const appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleMeta) {
    appleMeta.setAttribute('content', isDark ? 'black-translucent' : 'default');
  }
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setThemeStore = useUIStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = theme === 'dark';
    const isDarkClass = document.documentElement.classList.contains('dark');
    if (isDark && !isDarkClass) {
      document.documentElement.classList.add('dark');
    } else if (!isDark && isDarkClass) {
      document.documentElement.classList.remove('dark');
    }
    syncThemeColorMeta(isDark);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const nextIsDark = nextTheme === 'dark';
    if (typeof document !== 'undefined') {
      if (nextIsDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      syncThemeColorMeta(nextIsDark);
    }
    setThemeStore(nextTheme);
  }, [theme, setThemeStore]);

  const setTheme = useCallback(
    (newTheme: 'light' | 'dark') => {
      const nextIsDark = newTheme === 'dark';
      if (typeof document !== 'undefined') {
        if (nextIsDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        syncThemeColorMeta(nextIsDark);
      }
      setThemeStore(newTheme);
    },
    [setThemeStore]
  );

  const isDark = theme === 'dark';

  return { theme, toggleTheme, setTheme, isDark, mounted };
}
