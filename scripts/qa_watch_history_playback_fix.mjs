// scripts/qa_watch_history_playback_fix.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://liortxbcrqjqborqqchh.supabase.co';
const ANON_KEY = 'sb_publishable_coDxCxZCPZSuqA5VNFlleg_emyITDk2';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb3J0eGJjcnFqcWJvcnFxY2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDkzMzU0NywiZXhwIjoyMTA2NTA5NTQ3fQ.KYjTQkvu6MDbYyiXLoJgiNEj8QUURGq6EmR40ilGxLg';

console.log('================================================================');
console.log('=== [QA TEST 1] YOUTUBE VIDEO ID REGEX & ID RESOLUTION LOGIC ===');
console.log('================================================================');

const testCases = [
  { id: '739c98c2-a97f-41eb-90e8-1cb67904e2db', isDirectYt: false, desc: 'Database UUID from screenshot' },
  { id: '-4--GpIk9Qk', isDirectYt: true, desc: 'Valid 11-char YouTube Video ID' },
  { id: 'dQw4w9WgXcQ', isDirectYt: true, desc: 'Standard 11-char YouTube Video ID' },
  { id: 'invalid_too_long_1234567890', isDirectYt: false, desc: 'String too long' },
  { id: 'short', isDirectYt: false, desc: 'String too short' },
  { id: '', isDirectYt: false, desc: 'Empty string' },
];

let test1Pass = true;
const ytRegex = /^[a-zA-Z0-9_-]{11}$/;

for (const tc of testCases) {
  const matches = ytRegex.test(tc.id);
  if (matches === tc.isDirectYt) {
    console.log(`[PASS] "${tc.id}" -> ${matches ? 'Direct YouTube ID' : 'Database ID / Not YouTube ID'} (${tc.desc})`);
  } else {
    console.error(`[FAIL] "${tc.id}" expected isDirectYt=${tc.isDirectYt}, got ${matches}`);
    test1Pass = false;
  }
}

console.log('\n================================================================');
console.log('=== [QA TEST 2] DATABASE LOOKUP: UUID & YOUTUBE ID LOOKUP    ===');
console.log('================================================================');

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

const targetUuid = '739c98c2-a97f-41eb-90e8-1cb67904e2db';
const targetYtId = '-4--GpIk9Qk';

let test2Pass = true;

// 1. Lookup by UUID
const { data: videoByUuid, error: uuidErr } = await adminClient
  .from('videos')
  .select('*')
  .eq('id', targetUuid)
  .maybeSingle();

if (videoByUuid && videoByUuid.youtube_video_id === targetYtId) {
  console.log(`[PASS] Lookup by UUID (${targetUuid}):`);
  console.log(`       Resolved Title: "${videoByUuid.title.slice(0, 50)}..."`);
  console.log(`       Resolved YouTube ID: "${videoByUuid.youtube_video_id}" (Duration: ${videoByUuid.duration_seconds}s)`);
} else {
  console.error(`[FAIL] Lookup by UUID failed:`, uuidErr);
  test2Pass = false;
}

// 2. Lookup by YouTube ID
const { data: videoByYt, error: ytErr } = await adminClient
  .from('videos')
  .select('*')
  .eq('youtube_video_id', targetYtId)
  .maybeSingle();

if (videoByYt && videoByYt.id === targetUuid) {
  console.log(`[PASS] Lookup by YouTube ID (${targetYtId}):`);
  console.log(`       Resolved DB UUID: "${videoByYt.id}"`);
} else {
  console.error(`[FAIL] Lookup by YouTube ID failed:`, ytErr);
  test2Pass = false;
}

// 3. Lookup channel
if (videoByUuid) {
  const { data: channel, error: chErr } = await adminClient
    .from('channels')
    .select('*')
    .eq('id', videoByUuid.channel_id)
    .maybeSingle();

  if (channel) {
    console.log(`[PASS] Channel Lookup (${videoByUuid.channel_id}):`);
    console.log(`       Channel Title: "${channel.title}"`);
  } else {
    console.error(`[FAIL] Channel lookup failed:`, chErr);
    test2Pass = false;
  }
}

console.log('\n================================================================');
console.log('=== [QA TEST 3] EDGE FUNCTION & RPC CONNECTIVITY             ===');
console.log('================================================================');

let test3Pass = true;
try {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-child-watch-history`, {
    method: 'OPTIONS',
  });
  if (res.status === 200) {
    console.log('[PASS] Edge function get-child-watch-history: OPTIONS CORS HTTP 200');
  } else {
    console.error(`[FAIL] Edge function get-child-watch-history: HTTP ${res.status}`);
    test3Pass = false;
  }
} catch (err) {
  console.error('[FAIL] Edge function fetch error:', err.message);
  test3Pass = false;
}

console.log('\n================================================================');
console.log('=== FINAL QA SUMMARY                                         ===');
console.log('================================================================');
const allPass = test1Pass && test2Pass && test3Pass;
console.log(`Overall QA Test Status: ${allPass ? 'ALL TESTS PASSED (100% SUCCESS)' : 'SOME TESTS FAILED'}`);
process.exit(allPass ? 0 : 1);
