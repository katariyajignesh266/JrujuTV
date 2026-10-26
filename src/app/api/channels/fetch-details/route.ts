// src/app/api/channels/fetch-details/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function parseChannelUrl(rawUrl: string): { type: 'channel' | 'handle' | 'custom' | 'user'; identifier: string } | null {
  const clean = rawUrl.trim();
  if (!clean) return null;

  if (clean.startsWith('@')) {
    return { type: 'handle', identifier: clean };
  }

  try {
    const url = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const pathname = url.pathname.replace(/\/$/, '');

    const channelMatch = pathname.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) return { type: 'channel', identifier: channelMatch[1] };

    const handleMatch = pathname.match(/\/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) return { type: 'handle', identifier: `@${handleMatch[1]}` };

    const customMatch = pathname.match(/\/c\/([a-zA-Z0-9_.-]+)/);
    if (customMatch) return { type: 'custom', identifier: customMatch[1] };

    const userMatch = pathname.match(/\/user\/([a-zA-Z0-9_.-]+)/);
    if (userMatch) return { type: 'user', identifier: userMatch[1] };

    const directPath = pathname.split('/').filter(Boolean)[0];
    if (directPath) return { type: 'handle', identifier: `@${directPath}` };
  } catch {
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Parent login required.' }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid YouTube channel URL is required' }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'YOUTUBE_API_KEY is not configured in server environment.' },
        { status: 500 }
      );
    }

    const parsed = parseChannelUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid YouTube channel URL. Format as youtube.com/@handle or youtube.com/channel/UC...' },
        { status: 400 }
      );
    }

    let youtubeChannelId: string | null = null;
    let channelItem: any = null;

    if (parsed.type === 'channel') {
      youtubeChannelId = parsed.identifier;
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${youtubeChannelId}&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        channelItem = data.items[0];
      }
    } else if (parsed.type === 'handle') {
      const handleClean = parsed.identifier.startsWith('@') ? parsed.identifier : `@${parsed.identifier}`;
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&forHandle=${encodeURIComponent(handleClean)}&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        channelItem = data.items[0];
        youtubeChannelId = channelItem.id;
      }
    } else if (parsed.type === 'user') {
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&forUsername=${encodeURIComponent(parsed.identifier)}&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        channelItem = data.items[0];
        youtubeChannelId = channelItem.id;
      }
    }

    // Fallback search
    if (!channelItem) {
      const searchTerm = parsed.identifier.replace(/^@/, '');
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchTerm)}&maxResults=1&key=${apiKey}`;
      const sRes = await fetch(searchUrl);
      const sData = await sRes.json();
      if (sData.items && sData.items.length > 0) {
        youtubeChannelId = sData.items[0].snippet?.channelId || sData.items[0].id?.channelId;
        if (youtubeChannelId) {
          const detailUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${youtubeChannelId}&key=${apiKey}`;
          const dRes = await fetch(detailUrl);
          const dData = await dRes.json();
          if (dData.items && dData.items.length > 0) {
            channelItem = dData.items[0];
          }
        }
      }
    }

    if (!channelItem || !youtubeChannelId) {
      return NextResponse.json({ error: 'YouTube channel not found. Please verify the URL or handle.' }, { status: 404 });
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

    // Check duplicate
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('parent_id', user.id)
      .eq('youtube_channel_id', youtubeChannelId)
      .maybeSingle();

    return NextResponse.json({
      youtube_channel_id: youtubeChannelId,
      title,
      thumbnail_url: thumbnailUrl,
      subscriber_count: subscriberCount,
      video_count: videoCount,
      uploads_playlist_id: uploadsPlaylistId,
      already_added: !!existing,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
