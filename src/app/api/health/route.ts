import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Lightweight health-check endpoint — zero dependencies.
 * Used by EXTERNAL uptime monitors (UptimeRobot, cron-job.org, GitHub Actions)
 * to ping the server every 5 minutes and prevent Render.com's free-tier
 * service from going to sleep.
 *
 * This route is excluded from Supabase middleware (see src/middleware.ts)
 * so it never calls getUser() and responds in < 10ms.
 *
 * Supports both GET (full JSON) and HEAD (status-only, minimal bandwidth).
 */

const startTime = Date.now();

const HEALTH_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'JruJuTV',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
    {
      status: 200,
      headers: HEALTH_HEADERS,
    }
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: HEALTH_HEADERS,
  });
}
