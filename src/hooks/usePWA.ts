// src/hooks/usePWA.ts
// Registers the service worker and wires up install-prompt capture.
// Called once at app root via PWAProvider.

'use client';

import { useEffect } from 'react';
import { usePWAStore, type BeforeInstallPromptEvent } from '@/store/pwaStore';

export function usePWA() {
  const { setDeferredPrompt, setInstalled, setIOSSafari } = usePWAStore();

  useEffect(() => {
    // ── 1. Detect already-installed (standalone display mode) ──────────────
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari on iOS uses navigator.standalone (non-standard)
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setInstalled(true);
    }

    // ── 2. Detect iOS Safari (no beforeinstallprompt support) ──────────────
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      // iPadOS 13+ reports a Macintosh UA — detect via touch support
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari =
      /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua) && !/Chrome/.test(ua);
    if (isIOS && isSafari && !isStandalone) {
      setIOSSafari(true);
    }

    // ── 3. Capture install prompt (Chrome/Edge/Android) ────────────────────
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // suppress automatic mini-infobar
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // ── 4. Handle post-install event ───────────────────────────────────────
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // ── 5. Register service worker (production only) ───────────────────────
    if (
      process.env.NODE_ENV === 'production' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service worker registered, scope:', registration.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service worker registration failed:', err);
        });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [setDeferredPrompt, setInstalled, setIOSSafari]);
}

