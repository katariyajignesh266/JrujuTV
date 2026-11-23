import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const received = new Date().toISOString();
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({code:'AUTH_REQUIRED'}, {status:401});
  const body = await request.json().catch(() => null);
  if (!body || !['day','join','presence','start','interval','depart','logout'].includes(body.kind)) {
    return Response.json({code:'INVALID_ACTIVITY'}, {status:400});
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apiKey) return Response.json({code:'SERVICE_CONFIGURATION'}, {status:503});

  try {
    if (body.kind !== 'day' || !serviceKey) {
      // The Edge writer also dispatches push immediately. A gateway-confirmed missing
      // function can safely fall back to the same idempotent Postgres writer.
      const edge = await fetch(url + '/functions/v1/child-activity', {
        method:'POST', cache:'no-store', redirect:'error',
        headers:{authorization, apikey:apiKey, 'Content-Type':'application/json'},
        body:JSON.stringify(body),
      });
      const result = await edge.json();
      if (edge.status !== 404 || result?.code !== 'NOT_FOUND') {
        const retryAfter = edge.headers.get('Retry-After');
        return Response.json(result, {status:edge.status, headers:retryAfter ? {'Retry-After':retryAfter} : {}});
      }
    }
    if (!serviceKey) return Response.json({code:'ACTIVITY_ROUTE_MISSING'}, {status:503});
    const { childActivity } = await import('../../../../supabase/functions/_shared/childActivity');
    const admin = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    return await childActivity(admin,authorization.slice(7),body,received);
  } catch {
    return Response.json({code:'ACTIVITY_SERVICE_UNAVAILABLE'},{status:503});
  }
}
