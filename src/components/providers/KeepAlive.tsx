'use client';

import { useEffect } from 'react';

/**
 * KeepAlive
 *
 * Invisible component — renders nothing in the UI.
 *
 * Pings GET /api/health every 10 minutes to prevent the Render.com
 * free-tier service from going to sleep (Render's inactivity threshold is 15
 * minutes; we use 10 min to keep a 5-minute safety margin).
 *
 * Mount this once at the root layout so it stays alive for the entire session.
 */

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function ping() {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      // Bypass any service-worker or browser cache so the request always
      // reaches the server.
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[KeepAlive] health ping returned', res.status);
    }
  } catch (err) {
    // Network errors are expected during offline / page-unload — safe to ignore.
    console.warn('[KeepAlive] health ping failed:', err);
  }
}

export function KeepAlive() {
  useEffect(() => {
    // Fire immediately on mount so the first 10-minute window starts now.
    ping();

    const id = setInterval(ping, INTERVAL_MS);

    // Clean up on component unmount (navigation away, tab close, etc.)
    return () => clearInterval(id);
  }, []);

  // Renders nothing — purely side-effect component.
  return null;
}
