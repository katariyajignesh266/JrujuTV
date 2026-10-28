'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';

/**
 * Ensures mobile browser status bar (<meta name="theme-color">) perfectly
 * mirrors the app state:
 *  1. When video player is in fullscreen: ALWAYS BLACK (#000000), regardless of mode!
 *  2. In normal mode:
 *     - Dark mode:  #0F0F0F
 *     - Light mode: #FFFFFF
 *
 * CRITICAL: Strips any `media` attribute (e.g. `(prefers-color-scheme: light)`)
 * so Android Chrome and Samsung Internet never override the app's chosen theme.
 */
export function syncThemeColorMeta(overrideColor?: string) {
  if (typeof document === 'undefined') return;

  const { theme, isPlayerFullscreen } = useUIStore.getState();

  let color: string;
  if (overrideColor) {
    color = overrideColor;
  } else if (isPlayerFullscreen) {
    color = '#000000';
  } else {
    color = theme === 'dark' ? '#0F0F0F' : '#FFFFFF';
  }

  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length > 0) {
    metas.forEach((meta) => {
      if (meta.hasAttribute('media')) {
        meta.removeAttribute('media');
      }
      meta.setAttribute('content', color);
    });
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  const isDarkColor = color === '#000000' || color === '#0F0F0F';
  const appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleMeta) {
    appleMeta.setAttribute('content', isDarkColor ? 'black-translucent' : 'default');
  } else {
    const apple = document.createElement('meta');
    apple.name = 'apple-mobile-web-app-status-bar-style';
    apple.content = isDarkColor ? 'black-translucent' : 'default';
    document.head.appendChild(apple);
  }
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

  // MutationObserver on <head> to guard against Next.js router injecting light theme-color meta tags
  useEffect(() => {
    if (typeof document === 'undefined') return;

    syncThemeColorMeta();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.tagName === 'META' && el.getAttribute('name') === 'theme-color') {
                syncThemeColorMeta();
              }
            }
          });
        } else if (mutation.type === 'attributes' && mutation.target) {
          const el = mutation.target as HTMLElement;
          if (el.tagName === 'META' && el.getAttribute('name') === 'theme-color') {
            const { theme: currentTheme, isPlayerFullscreen: isFs } = useUIStore.getState();
            const expectedColor = isFs ? '#000000' : currentTheme === 'dark' ? '#0F0F0F' : '#FFFFFF';
            if (el.getAttribute('content') !== expectedColor || el.hasAttribute('media')) {
              syncThemeColorMeta();
            }
          }
        }
      }
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
