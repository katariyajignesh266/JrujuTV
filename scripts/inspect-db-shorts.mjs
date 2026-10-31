// scripts/inspect-db-shorts.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function inspect() {
  const { data: channels, error: chErr } = await supabase
    .from('channels')
    .select('id, title, youtube_channel_id, shorts_enabled, shorts_limit, shorts_total_count');

  if (chErr) {
    console.error('Error fetching channels:', chErr);
    return;
  }

  console.log(`Found ${channels?.length} channels`);

  const { count: totalShorts } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('is_short', true);

  console.log('TOTAL SHORTS IN DB:', totalShorts);

  for (const c of channels || []) {
    const { count: chShorts } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', c.id)
      .eq('is_short', true);

    const { count: chVideos } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', c.id);

    console.log(`Channel [${c.title}] id=${c.id} limit=${c.shorts_limit} enabled=${c.shorts_enabled}: ${chShorts} shorts / ${chVideos} total videos`);
  }

  const { data: feed } = await supabase.rpc('get_shorts_feed', { p_seed: 42, p_cursor: 0, p_limit: 50 });
  console.log('GET_SHORTS_FEED returned:', feed?.videos?.length, 'videos, total:', feed?.total, 'has_more:', feed?.has_more, 'next_cursor:', feed?.next_cursor);

  // Check watch tracking / seen shorts
  const { data: views } = await supabase
    .from('short_views')
    .select('user_id, video_id, max_progress_percent')
    .gte('max_progress_percent', 50);

  console.log(`Total 50%+ viewed records in short_views: ${views?.length}`);
}

inspect();
