import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Validate the caller's JWT
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── CRITICAL AUTH CHECK: only child role may record watch progress ──────
    const role = user.app_metadata?.role
    if (role !== 'child') {
      return new Response(JSON.stringify({ error: 'Forbidden: child role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parentId = user.app_metadata?.parent_id
    if (!parentId) {
      return new Response(JSON.stringify({ error: 'Forbidden: missing parent_id claim' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const {
      video_id,
      channel_id,
      delta_seconds,
      absolute_position,
      video_duration,
      beat_timestamp,
    } = body

    // Validate required fields
    if (!video_id || !channel_id || delta_seconds === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── SECURITY: child_id always comes from the verified JWT, never from the body ──
    const childId = user.id

    // Use service role client to call the SECURITY DEFINER RPC
    // (which validates idempotency and does all four upserts atomically)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error: rpcError } = await adminClient.rpc('record_watch_progress', {
      p_child_id:          childId,
      p_parent_id:         parentId,
      p_video_id:          video_id,
      p_channel_id:        channel_id,
      p_delta_seconds:     Math.floor(Math.max(0, delta_seconds)),
      p_absolute_position: absolute_position ?? 0,
      p_video_duration:    Math.floor(Math.max(0, video_duration ?? 0)),
      p_beat_timestamp:    beat_timestamp ?? new Date().toISOString(),
    })

    if (rpcError) {
      console.error('record_watch_progress RPC error:', rpcError)
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data ?? { ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('record-watch-progress error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
