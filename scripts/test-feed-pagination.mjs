// scripts/test-feed-pagination.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function testPagination() {
  let cursor = 0;
  let page = 1;
  let totalFetched = 0;
  const seed = 123456;

  console.log('Testing feed pagination through all eligible shorts:');

  while (page <= 10) {
    const { data: res, error } = await supabase.rpc('get_shorts_feed', {
      p_seed: seed,
      p_cursor: cursor,
      p_limit: 50,
    });

    if (error) {
      console.error('Error on page', page, ':', error);
      break;
    }

    const count = res?.videos?.length || 0;
    totalFetched += count;
    console.log(`Page ${page}: fetched ${count} videos. has_more=${res?.has_more}, next_cursor=${res?.next_cursor}, total=${res?.total}`);

    if (!res?.has_more || !res?.next_cursor) {
      console.log('Reached end of feed.');
      break;
    }

    cursor = res.next_cursor;
    page++;
  }

  console.log(`Total fetched across ${page} pages: ${totalFetched}`);
}

testPagination();

