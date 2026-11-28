'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';

function getBrowserThemeColor() {
  const { theme, isPlayerFullscreen } = useUIStore.getState();
  if (isPlayerFullscreen) return '#000000';
  return theme === 'dark' || window.location.pathname === '/shorts' ? '#0F0F0F' : '#FFFFFF';
}

function setBrowserMeta(name: string, content: string) {
  const metas = document.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!metas.length) {
    const meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
    return;
  }

  metas.forEach((meta) => {
    if (meta.hasAttribute('media')) meta.removeAttribute('media');
    if (meta.content !== content) meta.content = content;
  });
}

export function syncThemeColorMeta(overrideColor?: string) {
  if (typeof document === 'undefined') return;

  const color = overrideColor || getBrowserThemeColor();
  const isDarkColor = color === '#000000' || color === '#0F0F0F';
  setBrowserMeta('theme-color', color);
  setBrowserMeta('apple-mobile-web-app-status-bar-style', isDarkColor ? 'black-translucent' : 'default');
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setThemeStore = useUIStore((s) => s.setTheme);
  const isPlayerFullscreen = useUIStore((s) => s.isPlayerFullscreen);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Sync <html> dark class & status bar theme-color on theme change, route change, or fullscreen change
  useEffect(() => {
    setMounted(true);
    const isDark = theme === 'dark';
    const isDarkClass = document.documentElement.classList.contains('dark');
    if (isDark && !isDarkClass) {
      document.documentElement.classList.add('dark');
    } else if (!isDark && isDarkClass) {
      document.documentElement.classList.remove('dark');
    }

    syncThemeColorMeta();
  }, [theme, isPlayerFullscreen, pathname]);

  // The router can insert its own metadata during client navigation.
  useEffect(() => {
    const isBrowserMeta = (node: Node) => node instanceof HTMLMetaElement &&
      (node.name === 'theme-color' || node.name === 'apple-mobile-web-app-status-bar-style');
    const observer = new MutationObserver((mutations) => {
      const metadataChanged = mutations.some((mutation) => mutation.type === 'attributes'
        ? isBrowserMeta(mutation.target)
        : Array.from(mutation.addedNodes).some(isBrowserMeta) || Array.from(mutation.removedNodes).some(isBrowserMeta));
      if (metadataChanged) syncThemeColorMeta();
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'media'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const nextIsDark = nextTheme === 'dark';
    if (typeof document !== 'undefined') {
      if (nextIsDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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
      }
      setThemeStore(newTheme);
    },
    [setThemeStore]
  );

  const isDark = theme === 'dark';

  return { theme, toggleTheme, setTheme, isDark, mounted };
}
