// src/app/api/push/resubscribe/route.ts
// Called by the Service Worker's `pushsubscriptionchange` handler when the
// browser invalidates a push subscription and generates a new one.
// This route is intentionally unauthenticated (the SW has no session cookie)
// but validates ownership via the old endpoint — only update rows that exist
// and match the old endpoint.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldEndpoint, subscription } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Use service role to bypass RLS — we validate by oldEndpoint existence
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
      // Look up the existing row to carry over parent_id
      const { data: existing } = await adminClient
        .from('push_subscriptions')
        .select('id, parent_id, user_agent')
        .eq('endpoint', oldEndpoint)
        .maybeSingle();

      if (existing) {
        // Delete the old row and insert the new one
        await adminClient
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', oldEndpoint);

        await adminClient
          .from('push_subscriptions')
          .insert({
            parent_id: existing.parent_id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            user_agent: existing.user_agent,
          });
      }
    } else if (!oldEndpoint) {
      // Upsert by new endpoint — if it already exists, update keys
      await adminClient
        .from('push_subscriptions')
        .upsert(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          { onConflict: 'endpoint', ignoreDuplicates: false }
        );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/resubscribe] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

