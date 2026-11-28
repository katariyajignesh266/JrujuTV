import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    return Response.json({ error: 'Service configuration missing' }, { status: 503 });
  }

  try {
    const token = authorization.slice(7);
    const admin = serviceKey
      ? createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : createClient(url, anonKey!, {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isChild =
      user.app_metadata?.role === 'child' || user.user_metadata?.role === 'child';

    let parentId: string | undefined;
    if (isChild) {
      parentId = user.app_metadata?.parent_id;
      if (!parentId) {
        const { data: childRow } = await admin
          .from('children')
          .select('parent_id')
          .eq('id', user.id)
          .maybeSingle();
        parentId = childRow?.parent_id;
      }
      if (!parentId) {
        return Response.json({ error: 'Forbidden: missing parent_id claim' }, { status: 403 });
      }
    } else {
      parentId = user.id;
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      video_id,
      channel_id,
      delta_seconds,
      absolute_position,
      video_duration,
      beat_timestamp,
    } = body;

    if (!video_id || !channel_id || delta_seconds === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error: rpcError } = await admin.rpc('record_watch_progress', {
      p_child_id: user.id,
      p_parent_id: parentId,
      p_video_id: video_id,
      p_channel_id: channel_id,
      p_delta_seconds: Math.floor(Math.max(0, Number(delta_seconds) || 0)),
      p_absolute_position: Number(absolute_position) || 0,
      p_video_duration: Math.floor(Math.max(0, Number(video_duration) || 0)),
      p_beat_timestamp: beat_timestamp ?? new Date().toISOString(),
    });

    if (rpcError) {
      return Response.json({ error: rpcError.message }, { status: 500 });
    }

    return Response.json(data ?? { ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
