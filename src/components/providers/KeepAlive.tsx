'use client';

import { useEffect } from 'react';

/**
 * KeepAlive — SUPPLEMENTARY client-side pinger (active only while users browse)
 *
 * ⚠️  THIS COMPONENT CANNOT KEEP THE SERVER ALIVE ON ITS OWN.
 * It runs in the user's BROWSER via React useEffect. When no browser tabs are
 * open (overnight, weekends, etc.), this timer does not run and zero pings are
 * sent. Render will sleep the service after 15 minutes of no traffic.
 *
 * The PRIMARY keep-alive mechanisms are:
 *   1. External pingers (UptimeRobot, cron-job.org) — see KEEPALIVE.md
 *   2. GitHub Actions cron — .github/workflows/keep-alive.yml
 *   3. Server-side self-pinger — src/lib/keep-alive-server.ts
 *
 * This component is a BELT-AND-SUSPENDERS extra: while a user is actively
 * browsing, it pings /api/health every 5 minutes to help prevent sleep.
 */

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — supplementary to external pingers

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
    // Fire immediately on mount so the first 5-minute window starts now.
    ping();

    const id = setInterval(ping, INTERVAL_MS);

    // Clean up on component unmount (navigation away, tab close, etc.)
    return () => clearInterval(id);
  }, []);

  // Renders nothing — purely side-effect component.
  return null;
}
