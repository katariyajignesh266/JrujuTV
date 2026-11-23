import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function checkActivityRoute(base) {
  const response = await fetch(new URL('/functions/v1/child-activity', base), {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({kind:'day'}),
    signal:AbortSignal.timeout(15000)
  });
  const body = await response.json().catch(()=>null);
  assert.ok(response.status === 401 && body?.code === 'AUTH_REQUIRED',
    'Expected the deployed activity handler to reject an unsigned request; HTTP '+response.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkActivityRoute(process.argv[2] || process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Activity route reached its authentication check.');
}
