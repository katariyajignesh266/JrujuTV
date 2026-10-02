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
    
    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user: parentUser }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !parentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { username, display_name, password } = await req.json()

    if (!username || !display_name || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{1,18}[a-zA-Z0-9])?$/
    if (!usernameRegex.test(username)) {
      return new Response(JSON.stringify({ error: 'Invalid username format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const trimmedDisplayName = display_name.trim()
    if (trimmedDisplayName.length < 1 || trimmedDisplayName.length > 50) {
      return new Response(JSON.stringify({ error: 'Invalid display name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 4 || password.length > 20 || /\s/.test(password)) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lowerUsername = username.toLowerCase()
    
    const { data: existingChild, error: existingError } = await adminClient
      .from('children')
      .select('id')
      .ilike('username', lowerUsername)
      .single()

    if (existingChild) {
      return new Response(JSON.stringify({ error: 'Username is already taken' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const syntheticEmail = `${lowerUsername}@child.jrujutv.internal`
    
    const { data: authData, error: authCreateError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'child', parent_id: parentUser.id }
    })

    if (authCreateError) {
      return new Response(JSON.stringify({ error: authCreateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newUserId = authData.user.id

    const { error: insertError } = await adminClient
      .from('children')
      .insert({
        id: newUserId,
        parent_id: parentUser.id,
        username: lowerUsername,
        display_name: trimmedDisplayName
      })

    if (insertError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: 'Failed to create child profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      child: { id: newUserId, username: lowerUsername, display_name: trimmedDisplayName } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
