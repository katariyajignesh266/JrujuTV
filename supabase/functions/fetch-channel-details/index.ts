import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseChannelUrl(rawUrl: string): { type: 'channel' | 'handle' | 'custom' | 'user'; identifier: string } | null {
  const clean = rawUrl.trim();
  if (!clean) return null;

  // Handle bare handle e.g. @MrBeast
  if (clean.startsWith('@')) {
    return { type: 'handle', identifier: clean };
  }

  try {
    const url = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const pathname = url.pathname.replace(/\/$/, '');

    // /channel/UC...
    const channelMatch = pathname.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return { type: 'channel', identifier: channelMatch[1] };
    }

    // /@handle
    const handleMatch = pathname.match(/\/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) {
      return { type: 'handle', identifier: `@${handleMatch[1]}` };
    }

    // /c/CustomName
    const customMatch = pathname.match(/\/c\/([a-zA-Z0-9_.-]+)/);
    if (customMatch) {
      return { type: 'custom', identifier: customMatch[1] };
    }

    // /user/Username
    const userMatch = pathname.match(/\/user\/([a-zA-Z0-9_.-]+)/);
    if (userMatch) {
      return { type: 'user', identifier: userMatch[1] };
    }

    // Direct path e.g. youtube.com/handle (when without @)
    const directPath = pathname.split('/').filter(Boolean)[0];
    if (directPath && directPath.length > 0) {
      return { type: 'handle', identifier: `@${directPath}` };
    }
  } catch {
    // String matching fallback
    if (clean.includes('/channel/')) {
      const parts = clean.split('/channel/');
      return { type: 'channel', identifier: parts[1].split('/')[0].split('?')[0] };
    }
    if (clean.includes('/@')) {
      const parts = clean.split('/@');
      return { type: 'handle', identifier: `@${parts[1].split('/')[0].split('?')[0]}` };
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') ?? '';

    if (!youtubeApiKey) {
      return new Response(
        JSON.stringify({
          error: 'YouTube API Key not configured. Please set YOUTUBE_API_KEY secret.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    let userId: string = '';
    if (token === supabaseServiceKey) {
      userId = '00000000-0000-0000-0000-000000000000';
    } else {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const { url } = body;
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid YouTube channel URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = parseChannelUrl(url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: 'Could not parse YouTube channel URL. Format as youtube.com/@handle or youtube.com/channel/UC...' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let youtubeChannelId: string | null = null;
    let channelItem: any = null;

    if (parsed.type === 'channel') {
      youtubeChannelId = parsed.identifier;
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${youtubeChannelId}&key=${youtubeApiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        channelItem = data.items[0];
      }
    } else if (parsed.type === 'handle') {
      const handleClean = parsed.identifier.startsWith('@') ? parsed.identifier : `@${parsed.identifier}`;
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&forHandle=${encodeURIComponent(handleClean)}&key=${youtubeApiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        channelItem = data.items[0];
        youtubeChannelId = channelItem.id;
      }
    } else if (parsed.type === 'user') {
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&forUsername=${encodeURIComponent(parsed.identifier)}&key=${youtubeApiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        channelItem = data.items[0];
        youtubeChannelId = channelItem.id;
      }
    }

    // Fallback: search.list
    if (!channelItem) {
      const searchTerm = parsed.identifier.replace(/^@/, '');
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchTerm)}&maxResults=1&key=${youtubeApiKey}`;
      const sRes = await fetch(searchUrl);
      const sData = await sRes.json();
      if (sData.items && sData.items.length > 0) {
        youtubeChannelId = sData.items[0].snippet.channelId || sData.items[0].id.channelId;
        if (youtubeChannelId) {
          const detailUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${youtubeChannelId}&key=${youtubeApiKey}`;
          const dRes = await fetch(detailUrl);
          const dData = await dRes.json();
          if (dData.items && dData.items.length > 0) {
            channelItem = dData.items[0];
          }
        }
      }
    }

    if (!channelItem || !youtubeChannelId) {
      return new Response(JSON.stringify({ error: 'YouTube channel not found. Please check the URL or handle.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const snippet = channelItem.snippet || {};
    const stats = channelItem.statistics || {};
    const contentDetails = channelItem.contentDetails || {};

    const title = snippet.title || 'Untitled Channel';
    const thumbnailUrl =
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      '';
    const subscriberCount = parseInt(stats.subscriberCount || '0', 10);
    const videoCount = parseInt(stats.videoCount || '0', 10);
    const uploadsPlaylistId = contentDetails.relatedPlaylists?.uploads || '';

    // Check if duplicate for this parent
    let isAlreadyAdded = false;
    if (userId && userId !== '00000000-0000-0000-0000-000000000000') {
      const { data: existingChannel } = await supabaseClient
        .from('channels')
        .select('id')
        .eq('parent_id', userId)
        .eq('youtube_channel_id', youtubeChannelId)
        .maybeSingle();
      isAlreadyAdded = !!existingChannel;
    }

    return new Response(
      JSON.stringify({
        youtube_channel_id: youtubeChannelId,
        title,
        thumbnail_url: thumbnailUrl,
        subscriber_count: subscriberCount,
        video_count: videoCount,
        uploads_playlist_id: uploadsPlaylistId,
        already_added: isAlreadyAdded,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch channel details';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
