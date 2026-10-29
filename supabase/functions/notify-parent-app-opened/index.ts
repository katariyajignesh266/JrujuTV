import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// web-push via esm.sh — provides VAPID-signed Web Push delivery for Deno
// @ts-ignore — no type declarations for this ESM import
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // ── CORS preflight ───────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Auth: child JWT required ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@jrujutv.example.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[notify-parent] VAPID keys not configured')
      // Return ok to child — notification system not yet configured
      return new Response(JSON.stringify({ ok: true, skipped: 'vapid_not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Set VAPID details once
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // ── Verify JWT and extract child user ───────────────────────────────
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Confirm caller is a child ────────────────────────────────────────
    const isChild =
      user.app_metadata?.role === 'child' ||
      user.user_metadata?.role === 'child'

    if (!isChild) {
      return new Response(JSON.stringify({ error: 'Forbidden: child role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Resolve parent_id ────────────────────────────────────────────────
    let parentId: string | null = user.app_metadata?.parent_id ?? null
    if (!parentId) {
      const { data: childRow } = await adminClient
        .from('children')
        .select('parent_id')
        .eq('id', user.id)
        .maybeSingle()
      parentId = childRow?.parent_id ?? null
    }

    if (!parentId) {
      return new Response(JSON.stringify({ error: 'Forbidden: parent_id not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch child's display_name for the notification body ─────────────
    const { data: childData } = await adminClient
      .from('children')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    const childName =
      childData?.display_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      'Your child'

    // ── Fetch all parent's push subscriptions ────────────────────────────
    const { data: subscriptions, error: subError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('parent_id', parentId)

    if (subError) {
      console.error('[notify-parent] Failed to fetch subscriptions:', subError)
      return new Response(JSON.stringify({ ok: true, skipped: 'db_error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!subscriptions || subscriptions.length === 0) {
      // Parent hasn't subscribed yet — that's fine
      return new Response(JSON.stringify({ ok: true, skipped: 'no_subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Build notification payload ────────────────────────────────────────
    const notificationPayload = JSON.stringify({
      title: 'JruJu TV',
      body: `${childName} started watching 📺`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: {
        child_id: user.id,
        url: '/profile',
      },
    })

    // ── Fan-out: send to all subscriptions in parallel ───────────────────
    const staleIds: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            notificationPayload,
            { TTL: 60 * 60 } // 1 hour TTL — drop if parent device is offline that long
          )
        } catch (err: any) {
          const statusCode = err?.statusCode ?? err?.status ?? 0
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is expired / unsubscribed — mark for cleanup
            staleIds.push(sub.id)
            console.log(`[notify-parent] Stale subscription ${sub.id} (${statusCode}) — will delete`)
          } else {
            console.error(`[notify-parent] Push failed for sub ${sub.id}:`, err?.message ?? err)
          }
        }
      })
    )

    // ── Clean up stale subscriptions ─────────────────────────────────────
    if (staleIds.length > 0) {
      const { error: delError } = await adminClient
        .from('push_subscriptions')
        .delete()
        .in('id', staleIds)

      if (delError) {
        console.error('[notify-parent] Failed to delete stale subs:', delError)
      } else {
        console.log(`[notify-parent] Deleted ${staleIds.length} stale subscription(s)`)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[notify-parent] Unhandled error:', err)
    // Always return 200 to child — never block child experience
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

