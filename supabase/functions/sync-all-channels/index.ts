import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active channels that need syncing (e.g. older than 24h or never synced)
    const { data: channels, error } = await adminClient
      .from('channels')
      .select('id, title')
      .eq('is_active', true)
      .limit(20);

    if (error) throw error;

    const results = [];
    for (const channel of channels || []) {
      try {
        const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-channel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ channelId: channel.id }),
        });
        const resJson = await syncRes.json();
        results.push({ channelId: channel.id, title: channel.title, result: resJson });
      } catch (err: any) {
        results.push({ channelId: channel.id, title: channel.title, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch sync failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
