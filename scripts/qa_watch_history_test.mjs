// scripts/qa_watch_history_test.mjs
const SUPABASE_URL = 'https://liortxbcrqjqborqqchh.supabase.co';
const ANON_KEY = 'sb_publishable_coDxCxZCPZSuqA5VNFlleg_emyITDk2';

console.log('================================================================');
console.log('=== [1] QA TEST: DATABASE RPC FUNCTIONS (PostgREST Schema)   ===');
console.log('================================================================');

const rpcTests = [
  {
    name: 'get_child_watch_summary',
    endpoint: `${SUPABASE_URL}/rest/v1/rpc/get_child_watch_summary`,
    body: { p_child_id: '00000000-0000-0000-0000-000000000000' },
  },
  {
    name: 'get_child_watch_history',
    endpoint: `${SUPABASE_URL}/rest/v1/rpc/get_child_watch_history`,
    body: { p_child_id: '00000000-0000-0000-0000-000000000000', p_limit: 10 },
  },
  {
    name: 'get_child_watch_channels',
    endpoint: `${SUPABASE_URL}/rest/v1/rpc/get_child_watch_channels`,
    body: { p_child_id: '00000000-0000-0000-0000-000000000000' },
  },
  {
    name: 'get_children_today_summary',
    endpoint: `${SUPABASE_URL}/rest/v1/rpc/get_children_today_summary`,
    body: { p_parent_id: '00000000-0000-0000-0000-000000000000' },
  },
];

let rpcPass = true;
for (const test of rpcTests) {
  try {
    const res = await fetch(test.endpoint, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test.body),
    });
    const text = await res.text();
    if (res.ok) {
      console.log(`[PASS] RPC ${test.name}: HTTP ${res.status} -> ${text.slice(0, 80)}...`);
    } else {
      console.error(`[FAIL] RPC ${test.name}: HTTP ${res.status} -> ${text}`);
      rpcPass = false;
    }
  } catch (err) {
    console.error(`[FAIL] RPC ${test.name}: ${err.message}`);
    rpcPass = false;
  }
}

console.log('\n================================================================');
console.log('=== [2] QA TEST: SUPABASE EDGE FUNCTIONS (CORS & Endpoints)  ===');
console.log('================================================================');

const efList = [
  'get-child-watch-summary',
  'get-child-watch-history',
  'get-child-watch-channels',
  'get-children-today-summary',
  'record-watch-progress',
];

let efPass = true;
for (const ef of efList) {
  try {
    // 1. Check OPTIONS (CORS preflight)
    const optionsRes = await fetch(`${SUPABASE_URL}/functions/v1/${ef}`, { method: 'OPTIONS' });
    const allowHeaders = optionsRes.headers.get('access-control-allow-headers');
    const corsOk = optionsRes.status === 200 && allowHeaders && allowHeaders.includes('authorization');

    // 2. Check POST without token returns proper 401 Unauthorized (not 404 or 500)
    const postRes = await fetch(`${SUPABASE_URL}/functions/v1/${ef}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const authOk = postRes.status === 401;

    if (corsOk && authOk) {
      console.log(`[PASS] Edge Function ${ef}: CORS HTTP 200, Auth validation HTTP 401`);
    } else {
      console.error(`[FAIL] Edge Function ${ef}: CORS=${optionsRes.status}, Auth=${postRes.status}`);
      efPass = false;
    }
  } catch (err) {
    console.error(`[FAIL] Edge Function ${ef}: ${err.message}`);
    efPass = false;
  }
}

console.log('\n================================================================');
console.log('=== QA SUMMARY                                              ===');
console.log('================================================================');
console.log(`Database RPC Tests: ${rpcPass ? 'ALL PASSED' : 'SOME FAILED'}`);
console.log(`Edge Function Tests: ${efPass ? 'ALL PASSED' : 'SOME FAILED'}`);

if (!rpcPass || !efPass) {
  process.exit(1);
} else {
  console.log('All QA tests completed successfully!');
}
