// src/app/api/push/subscribe/route.ts
// Authenticated API route: persists or updates a parent's push subscription.
// Called by the parent's browser after PushManager.subscribe() succeeds.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, p256dh, auth, userAgent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only parents can subscribe
    const role = user.app_metadata?.role;
    const isParent = role === 'parent' || (!role && user.app_metadata?.role !== 'child');
    if (!isParent) {
      return NextResponse.json({ error: 'Forbidden: parent account required' }, { status: 403 });
    }

    // Upsert by endpoint (handles re-subscription on the same device)
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          parent_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent || null,
        },
        { onConflict: 'endpoint' }
      );

    if (upsertError) {
      console.error('[push/subscribe] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/subscribe] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

