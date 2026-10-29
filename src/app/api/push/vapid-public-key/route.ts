// src/app/api/push/vapid-public-key/route.ts
// Returns the VAPID public key as a JSON response.
// This is safe to expose — the public key is already in NEXT_PUBLIC_VAPID_PUBLIC_KEY
// on the client. This route lets the Service Worker (which cannot read env vars)
// fetch it dynamically for pushsubscriptionchange re-subscription.

import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 });
  }
  return NextResponse.json({ key }, {
    headers: {
      // Cache for 1 hour — the key rarely changes
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

