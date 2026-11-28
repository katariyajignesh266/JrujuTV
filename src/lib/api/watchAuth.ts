import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type WatchAuthResult =
  | { ok: true; admin: SupabaseClient; user: User; childId: string }
  | { ok: false; response: Response };

/**
 * Authenticates the bearer token and verifies that the caller is either
 * requesting their own watch data (parent or child) or a parent requesting
 * one of their linked children's watch data.
 */
export async function authorizeWatchViewer(request: Request): Promise<WatchAuthResult> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: Response.json({ error: 'Missing Authorization header' }, { status: 401 }),
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    return {
      ok: false,
      response: Response.json({ error: 'Service configuration missing' }, { status: 503 }),
    };
  }

  const token = authorization.slice(7);
  const admin = serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : createClient(url, anonKey!, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const body = await request.json().catch(() => null);
  const childId = body?.child_id;
  if (!childId || typeof childId !== 'string') {
    return { ok: false, response: Response.json({ error: 'Missing child_id' }, { status: 400 }) };
  }

  const isChild =
    user.app_metadata?.role === 'child' || user.user_metadata?.role === 'child';

  if (user.id !== childId) {
    if (isChild) {
      return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    const { data: childRow, error: childErr } = await admin
      .from('children')
      .select('id')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .maybeSingle();

    if (childErr || !childRow) {
      return {
        ok: false,
        response: Response.json(
          { error: 'Forbidden: child account not linked to this parent' },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, admin, user, childId };
}
