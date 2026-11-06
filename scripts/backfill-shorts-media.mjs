// scripts/backfill-shorts-media.mjs
// Runs backfill for all Shorts currently marked as 'pending' in the database.

import { ingestShortVideo } from './ingest-shorts.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function runBackfill() {
  console.log('=== SHORTS V2 MEDIA BACKFILL WORKER ===');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Ensure environment variables are loaded.');
    process.exit(1);
  }

  try {
    const queryUrl = `${SUPABASE_URL}/rest/v1/videos?is_short=eq.true&media_status=eq.pending&select=id,youtube_video_id,title&order=published_at.desc&limit=50`;
    const res = await fetch(queryUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch pending shorts: ${res.statusText}`);
    }

    const pendingVideos = await res.json();
    console.log(`Found ${pendingVideos.length} pending Shorts to process.\n`);

    if (pendingVideos.length === 0) {
      console.log('No pending Shorts. All videos are up to date!');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingVideos.length; i++) {
      const video = pendingVideos[i];
      console.log(`[${i + 1}/${pendingVideos.length}] Ingesting: ${video.title} (${video.youtube_video_id})`);
      const result = await ingestShortVideo(video);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`\n=== BACKFILL COMPLETE ===`);
    console.log(`Successfully ingested: ${successCount}`);
    console.log(`Failed / Skipped: ${failCount}`);
  } catch (err) {
    console.error('Backfill worker error:', err);
    process.exit(1);
  }
}

runBackfill();

