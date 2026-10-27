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

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await anonClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── CRITICAL AUTH CHECK: child role or child account ──────
    const isChild = user.app_metadata?.role === 'child' || user.user_metadata?.role === 'child'
    if (!isChild) {
      return new Response(JSON.stringify({ error: 'Forbidden: child role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parentId = user.app_metadata?.parent_id
    if (!parentId) {
      const { data: childRow } = await adminClient
        .from('children')
        .select('parent_id')
        .eq('id', user.id)
        .maybeSingle()
      parentId = childRow?.parent_id
    }

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

    const childId = user.id

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
