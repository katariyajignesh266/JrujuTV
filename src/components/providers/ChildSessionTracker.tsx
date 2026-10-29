// src/components/providers/ChildSessionTracker.tsx
// Fires a fire-and-forget push notification to the linked parent whenever
// a child session's root app shell mounts under qualifying conditions.
//
// Debounce rule: at most once per 30-minute window per child session.
// State is stored in sessionStorage (key: jruju_child_notified_at).
// sessionStorage is cleared on tab close — so each new tab/browser window
// always fires on its first mount, but refocusing the same tab within the
// window does NOT trigger again (no visibilitychange re-trigger).
//
// The call is fire-and-forget: never awaited, never visible to the child.

'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';

const SESSION_KEY = 'jruju_child_notified_at';
const DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes

export function ChildSessionTracker() {
  const { role, session, initialized } = useAuthStore();
  const firedRef = useRef(false);

  useEffect(() => {
    // Only fire once per component mount — prevents React StrictMode double-fire
    if (firedRef.current) return;

    // Only act when auth is resolved and the user is a child with an active session
    if (!initialized || role !== 'child' || !session?.access_token) return;

    // ── Debounce: check sessionStorage timestamp ──────────────────────────
    const lastNotifiedStr = sessionStorage.getItem(SESSION_KEY);
    if (lastNotifiedStr) {
      const lastNotified = parseInt(lastNotifiedStr, 10);
      if (!isNaN(lastNotified) && Date.now() - lastNotified < DEBOUNCE_MS) {
        // Within the debounce window — skip
        return;
      }
    }

    // ── Mark as fired before the async call to prevent double-trigger ─────
    firedRef.current = true;
    sessionStorage.setItem(SESSION_KEY, Date.now().toString());

    // ── Fire-and-forget: call Edge Function ───────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    const token = session.access_token;

    // Best-effort: prefer fetch but fall back gracefully on any error
    fetch(`${supabaseUrl}/functions/v1/notify-parent-app-opened`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({}),
    }).catch((err) => {
      // Silent fail — never visible to the child
      console.debug('[ChildSessionTracker] Notification call failed (non-critical):', err);
    });
    // Intentionally NOT awaiting — fire-and-forget
  }, [initialized, role, session]);

  // Renders nothing — pure side-effect component
  return null;
}

