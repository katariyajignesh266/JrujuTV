'use client';

// src/components/providers/PWAProvider.tsx
// Mounts the PWA side effects (SW registration, install prompt capture).
// Renders nothing — pure effect component.

import { usePWA } from '@/hooks/usePWA';

export function PWAProvider() {
  usePWA();
  return null;
}

