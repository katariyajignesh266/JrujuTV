import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Lightweight health-check endpoint.
 * Used by the KeepAlive client component to ping the server every 10 minutes
 * so that Render.com's free-tier service never enters sleep mode
 * (Render sleeps after 15 minutes of inactivity — we stay well within that window).
 *
 * Also useful for external uptime monitors (UptimeRobot, BetterStack, etc.)
 * pointed at this URL.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'JruJuTV',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        // Prevent CDN / browser from caching the health response.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
