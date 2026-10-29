// src/hooks/usePushNotifications.ts
// Manages Web Push subscription state for parent accounts.
// Handles: opt-in, subscription persistence, permission state detection,
// disable flow, and iOS Safari detection (install-first gate).

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePWAStore } from '@/store/pwaStore';

export type PushPermissionState = 'loading' | 'unsupported' | 'ios-needs-install' | 'denied' | 'default' | 'subscribed';

/** Converts a URL-safe base64 string to a Uint8Array for applicationServerKey */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { session } = useAuthStore();
  const { isIOSSafari, isInstalled } = usePWAStore();

  const [permissionState, setPermissionState] = useState<PushPermissionState>('loading');
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Detect current state on mount ──────────────────────────────────────
  useEffect(() => {
    async function detectState() {
      if (typeof window === 'undefined') return;

      // 1. Check browser support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPermissionState('unsupported');
        return;
      }

      // 2. iOS Safari not-installed gate
      if (isIOSSafari && !isInstalled) {
        setPermissionState('ios-needs-install');
        return;
      }

      // 3. Check permission
      const perm = Notification.permission;
      if (perm === 'denied') {
        setPermissionState('denied');
        return;
      }

      // 4. Check if already subscribed
      if (perm === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          if (existing) {
            setCurrentEndpoint(existing.endpoint);
            setPermissionState('subscribed');
            return;
          }
        } catch {
          // fall through to 'default'
        }
      }

      setPermissionState('default');
    }

    detectState();
  }, [isIOSSafari, isInstalled]);

  // ── Subscribe ──────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!session) return;
    setSubscribing(true);
    setError(null);

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPermissionState('denied');
        setSubscribing(false);
        return;
      }

      // 2. Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // 3. Get VAPID public key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY missing)');
      }

      // 4. Subscribe via PushManager
      const pushSubscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to ArrayBuffer to satisfy strict TS lib types for applicationServerKey
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      const subJson = pushSubscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Subscription object missing required fields');
      }

      // 5. Persist to Supabase
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save subscription');
      }

      setCurrentEndpoint(subJson.endpoint);
      setPermissionState('subscribed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable notifications';
      setError(msg);
      console.error('[usePushNotifications] subscribe error:', err);
    } finally {
      setSubscribing(false);
    }
  }, [session]);

  // ── Unsubscribe ────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!session) return;
    setUnsubscribing(true);
    setError(null);

    try {
      // 1. Get and unsubscribe from PushManager
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const endpoint = existing?.endpoint || currentEndpoint;

      if (existing) {
        await existing.unsubscribe();
      }

      // 2. Remove from Supabase
      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }

      setCurrentEndpoint(null);
      setPermissionState('default');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable notifications';
      setError(msg);
      console.error('[usePushNotifications] unsubscribe error:', err);
    } finally {
      setUnsubscribing(false);
    }
  }, [session, currentEndpoint]);

  return {
    permissionState,
    subscribing,
    unsubscribing,
    error,
    subscribe,
    unsubscribe,
  };
}
