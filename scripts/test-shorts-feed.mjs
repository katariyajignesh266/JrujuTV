// scripts/test-shorts-feed.mjs
// Automated Test Suite for Shorts Feed Algorithm & Business Rules

import assert from 'node:assert/strict';

console.log('=== RUNNING SHORTS FEED ALGORITHM & LOGIC TEST SUITE ===\n');

// 1. YouTube Video ID Validation & Sanitization Test
function isValidYouTubeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

function sanitizeAndDedupe(incoming, existing = []) {
  const seenIds = new Set();
  const seenYtIds = new Set();

  existing.forEach((v) => {
    if (v.id) seenIds.add(v.id);
    if (v.youtube_video_id) seenYtIds.add(v.youtube_video_id);
  });

  const validNew = [];
  for (const v of incoming) {
    if (!v) continue;
    const ytId = v.youtube_video_id?.trim();
    if (!isValidYouTubeId(ytId)) continue;
    if (seenYtIds.has(ytId) || (v.id && seenIds.has(v.id))) continue;

    seenIds.add(v.id);
    seenYtIds.add(ytId);
    validNew.push({ ...v, youtube_video_id: ytId });
  }

  return validNew;
}

// Test 1: ID Sanitization & Deduplication
console.log('Test 1: YouTube ID Sanitization & Deduplication');
const rawBatch = [
  { id: '1', youtube_video_id: 'dQw4w9WgXcQ', title: 'Valid 1' },
  { id: '2', youtube_video_id: 'invalid-id', title: 'Invalid' },
  { id: '3', youtube_video_id: ' dQw4w9WgXcQ ', title: 'Duplicate with spaces' },
  { id: '4', youtube_video_id: 'abcdefghijk', title: 'Valid 2' },
  { id: '5', youtube_video_id: '', title: 'Empty' },
];
const cleaned = sanitizeAndDedupe(rawBatch);
assert.equal(cleaned.length, 2, 'Should only keep valid non-duplicate videos');
assert.equal(cleaned[0].youtube_video_id, 'dQw4w9WgXcQ');
assert.equal(cleaned[1].youtube_video_id, 'abcdefghijk');
console.log('✓ Test 1 passed\n');

// 2. Strict Lane-by-Lane Round-Robin Simulation (SQL get_shorts_feed algorithm verification)
console.log('Test 2: 10-Channel Strict Lane-by-Lane Round-Robin Interleaving');

function simulateShortsFeed(channels, videosPerChannel, shortsLimit = null, watched50PercentIds = new Set()) {
  // 1. Rank channels by seeded hash
  const rankedChannels = channels.map((c, i) => ({
    ...c,
    channelRank: i + 1,
  }));

  // 2. Rank videos within each channel by published_at DESC
  const candidates = [];
  rankedChannels.forEach((ch) => {
    const vids = videosPerChannel[ch.id] || [];
    let rowWithinChannel = 1;
    vids.forEach((v) => {
      // 50% watched exclusion
      if (watched50PercentIds.has(v.id)) return;
      if (shortsLimit && rowWithinChannel > shortsLimit) return;

      candidates.push({
        ...v,
        channelId: ch.id,
        channelRank: ch.channelRank,
        rowWithinChannel: rowWithinChannel++,
      });
    });
  });

  // 3. Order candidates: rowWithinChannel ASC, channelRank ASC
  candidates.sort((a, b) => {
    if (a.rowWithinChannel !== b.rowWithinChannel) {
      return a.rowWithinChannel - b.rowWithinChannel;
    }
    return a.channelRank - b.channelRank;
  });

  return candidates;
}

// Setup 10 channels with 5 videos each
const channels10 = Array.from({ length: 10 }, (_, i) => ({ id: `ch_${i + 1}`, title: `Channel ${i + 1}` }));
const videos10 = {};
channels10.forEach((ch) => {
  videos10[ch.id] = Array.from({ length: 5 }, (_, j) => ({
    id: `vid_${ch.id}_${j + 1}`,
    youtube_video_id: `yt_${ch.id}_${j + 1}`.padEnd(11, '0'),
    title: `Video ${j + 1} of ${ch.title}`,
  }));
});

const feed10 = simulateShortsFeed(channels10, videos10);
assert.equal(feed10.length, 50, 'All 50 videos should be present');

// Verify round 1 has ch1..ch10 in order
for (let i = 0; i < 10; i++) {
  assert.equal(feed10[i].channelId, `ch_${i + 1}`, `Item ${i} should be from channel ${i + 1}`);
  assert.equal(feed10[i].rowWithinChannel, 1, 'Round 1 should be row 1');
}

// Verify round 2 has ch1..ch10 in order
for (let i = 10; i < 20; i++) {
  assert.equal(feed10[i].channelId, `ch_${i - 9}`, `Item ${i} should be from channel ${i - 9}`);
  assert.equal(feed10[i].rowWithinChannel, 2, 'Round 2 should be row 2');
}

// Verify no consecutive same-channel anywhere
for (let i = 1; i < feed10.length; i++) {
  assert.notEqual(
    feed10[i].channelId,
    feed10[i - 1].channelId,
    `Index ${i} and ${i - 1} must not have the same channel`
  );
}
console.log('✓ Test 2 passed: Strict lane-by-lane round-robin confirmed with zero consecutive same-channel\n');

// Test 3: Channel Exhaustion & Skipping
console.log('Test 3: Channel Exhaustion Skipping');
// ch_1 has 1 video, ch_2 has 3 videos, ch_3 has 5 videos
const unevenVideos = {
  ch_1: [{ id: 'v1_1', youtube_video_id: '11111111111' }],
  ch_2: [
    { id: 'v2_1', youtube_video_id: '22222222221' },
    { id: 'v2_2', youtube_video_id: '22222222222' },
    { id: 'v2_3', youtube_video_id: '22222222223' },
  ],
  ch_3: [
    { id: 'v3_1', youtube_video_id: '33333333331' },
    { id: 'v3_2', youtube_video_id: '33333333332' },
    { id: 'v3_3', youtube_video_id: '33333333333' },
    { id: 'v3_4', youtube_video_id: '33333333334' },
    { id: 'v3_5', youtube_video_id: '33333333335' },
  ],
};
const unevenChannels = [
  { id: 'ch_1', title: 'Channel 1' },
  { id: 'ch_2', title: 'Channel 2' },
  { id: 'ch_3', title: 'Channel 3' },
];
const unevenFeed = simulateShortsFeed(unevenChannels, unevenVideos);
assert.equal(unevenFeed.length, 9, 'Total 1 + 3 + 5 = 9 videos');
// Round 1: ch_1, ch_2, ch_3
assert.deepEqual(unevenFeed.slice(0, 3).map((v) => v.channelId), ['ch_1', 'ch_2', 'ch_3']);
// Round 2: ch_2, ch_3 (ch_1 exhausted and skipped!)
assert.deepEqual(unevenFeed.slice(3, 5).map((v) => v.channelId), ['ch_2', 'ch_3']);
// Round 3: ch_2, ch_3
assert.deepEqual(unevenFeed.slice(5, 7).map((v) => v.channelId), ['ch_2', 'ch_3']);
// Round 4 & 5: only ch_3 remaining
assert.deepEqual(unevenFeed.slice(7, 9).map((v) => v.channelId), ['ch_3', 'ch_3']);
console.log('✓ Test 3 passed: Exhausted channels gracefully skipped\n');

// Test 4: >= 50% Watched Exclusion
console.log('Test 4: >= 50% Watched Exclusion');
const watchedSet = new Set(['v1_1', 'v2_2', 'v3_1']);
const filteredFeed = simulateShortsFeed(unevenChannels, unevenVideos, null, watchedSet);
assert.equal(filteredFeed.find((v) => v.id === 'v1_1'), undefined, 'v1_1 watched >=50% must be excluded');
assert.equal(filteredFeed.find((v) => v.id === 'v2_2'), undefined, 'v2_2 watched >=50% must be excluded');
assert.equal(filteredFeed.find((v) => v.id === 'v3_1'), undefined, 'v3_1 watched >=50% must be excluded');
assert.equal(filteredFeed.length, 6, 'Remaining un-watched count must be 6');
console.log('✓ Test 4 passed: >= 50% watched items successfully excluded\n');

// Test 5: Parent Shorts Limit Setting
console.log('Test 5: Parent Shorts Limit per Channel');
const limitedFeed = simulateShortsFeed(unevenChannels, unevenVideos, 2);
// Limit 2 means at most 2 videos per channel
const ch3Count = limitedFeed.filter((v) => v.channelId === 'ch_3').length;
assert.equal(ch3Count, 2, 'Channel 3 should be capped at 2 videos despite having 5');
console.log('✓ Test 5 passed: Parent per-channel shorts_limit strictly honored\n');

// Test 6: Single Channel Edge Case
console.log('Test 6: Single Channel Edge Case');
const singleCh = [{ id: 'ch_1', title: 'Solo Channel' }];
const singleChFeed = simulateShortsFeed(singleCh, unevenVideos);
assert.equal(singleChFeed.length, 1);
assert.equal(singleChFeed[0].channelId, 'ch_1');
console.log('✓ Test 6 passed: Single channel works seamlessly\n');

// Test 7: Zero Channels / Empty State Edge Case
console.log('Test 7: Zero Channels Edge Case');
const zeroFeed = simulateShortsFeed([], {});
assert.equal(zeroFeed.length, 0);
console.log('✓ Test 7 passed: Empty state handled cleanly\n');

console.log('=== ALL 7 AUTOMATED UNIT TESTS PASSED SUCCESSFULLY! ===');

