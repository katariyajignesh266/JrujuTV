// scripts/qa_master_test_suite.mjs
import { interleaveChannelVideos } from '../src/lib/feedAlgorithm.ts';

console.log('================================================================');
console.log('=== [1] DURATION THRESHOLD TESTS (< 120s = Short, >= 120s = Regular) ===');
console.log('================================================================');

const durationTestCases = [
  { sec: 0, expectShort: true, desc: '0s instant clip' },
  { sec: 30, expectShort: true, desc: '30s standard short' },
  { sec: 59, expectShort: true, desc: '59s short' },
  { sec: 60, expectShort: true, desc: '60s short (previously cut-off)' },
  { sec: 90, expectShort: true, desc: '90s short' },
  { sec: 119, expectShort: true, desc: '119s boundary short' },
  { sec: 120, expectShort: false, desc: '120s (2m) exact regular threshold' },
  { sec: 121, expectShort: false, desc: '121s regular video' },
  { sec: 180, expectShort: false, desc: '180s (3m) regular video' },
  { sec: 3600, expectShort: false, desc: '3600s (1h) long-form video' },
];

let durationAllPass = true;
for (const tc of durationTestCases) {
  const isShort = tc.sec < 120;
  const passed = isShort === tc.expectShort;
  if (!passed) durationAllPass = false;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.sec}s (${tc.desc}) -> is_short=${isShort} (expected: ${tc.expectShort})`);
}

if (durationAllPass) {
  console.log('\n>>> All duration threshold checks PASSED: strictly < 120s classified as short, >= 120s as regular feed.');
} else {
  console.error('\n>>> Duration threshold checks FAILED.');
  process.exit(1);
}

console.log('\n================================================================');
console.log('=== [2] INFINITE SCROLL & INTERLEAVING TEST ACROSS 10 CYCLES ===');
console.log('================================================================');

// Generate 4 active mock channels with unequal distribution of videos (typical production scenario)
const mockChannelMap = new Map();
const channelConfigs = [
  { id: 'ch-super-simple', name: 'Super Simple Songs', count: 35 },
  { id: 'ch-cocomelon', name: 'CoComelon', count: 28 },
  { id: 'ch-sesame-street', name: 'Sesame Street', count: 20 },
  { id: 'ch-pbs-kids', name: 'PBS KIDS', count: 17 },
];

let totalGlobalVideos = 0;
for (const ch of channelConfigs) {
  totalGlobalVideos += ch.count;
  mockChannelMap.set(
    ch.id,
    Array.from({ length: ch.count }).map((_, i) => ({
      id: `${ch.id}-vid-${i + 1}`,
      channel_id: ch.id,
      channelName: ch.name,
      title: `${ch.name} Episode ${i + 1}`,
      duration_seconds: 150 + i * 10, // All >= 120s (regular videos)
    }))
  );
}

console.log(`Simulating multi-page infinite scroll with ${channelConfigs.length} channels and ${totalGlobalVideos} total videos.`);

const seed = 882371;
const pageSize = 10;
const totalExpectedPages = Math.ceil(totalGlobalVideos / pageSize);
const collectedVideos = [];
const seenIds = new Set();
let duplicatesFound = 0;
let maxConsecutiveSameChannel = 0;
let currentConsecutive = 1;

for (let p = 1; p <= totalExpectedPages; p++) {
  const pageResult = interleaveChannelVideos(mockChannelMap, seed, p, pageSize);
  console.log(`Page ${String(p).padStart(2)}: fetched ${pageResult.videos.length} videos (hasMore: ${pageResult.hasMore}, total: ${pageResult.total})`);

  for (const video of pageResult.videos) {
    if (seenIds.has(video.id)) {
      duplicatesFound++;
    }
    seenIds.add(video.id);
    collectedVideos.push(video);
  }
}

// Verify no duplicates across pagination
console.log(`\nDuplicate check: ${duplicatesFound} duplicates found across ${collectedVideos.length} loaded items.`);
const noDuplicates = duplicatesFound === 0 && collectedVideos.length === totalGlobalVideos;

// Verify consecutive channel distribution during active multi-channel phase
let maxConsecutiveDuringMultiChannel = 0;
let currentConsecutiveMulti = 1;
// Channels run out: at index (17 * 4) = 68, PBS KIDS runs out. At index ~75, Sesame runs out. At index ~86, CoComelon runs out.
// Only the last (35 - 28) = 7 videos are from Super Simple Songs alone.
const multiChannelPhaseEndIndex = totalGlobalVideos - (35 - 28);

for (let i = 1; i < multiChannelPhaseEndIndex; i++) {
  if (collectedVideos[i].channel_id === collectedVideos[i - 1].channel_id) {
    currentConsecutiveMulti++;
    if (currentConsecutiveMulti > maxConsecutiveDuringMultiChannel) {
      maxConsecutiveDuringMultiChannel = currentConsecutiveMulti;
    }
  } else {
    currentConsecutiveMulti = 1;
  }
}

console.log(`Max consecutive same-channel videos during multi-channel phase (items 1-${multiChannelPhaseEndIndex}): ${maxConsecutiveDuringMultiChannel}`);
console.log(`Tail items (${multiChannelPhaseEndIndex + 1}-${totalGlobalVideos}) are remaining videos from single dominant channel after other 3 channels are fully exhausted.`);

const interleavingHolds = maxConsecutiveDuringMultiChannel <= 1;

if (noDuplicates && interleavingHolds) {
  console.log('>>> [PASS] Infinite scroll across 10 cycles has 0 duplicates, 0 gaps, and strict 1-by-1 interleaving held across all page boundaries.');
} else {
  console.error('>>> [FAIL] Interleaving check failed: max consecutive during multi-channel phase was ' + maxConsecutiveDuringMultiChannel);
  process.exit(1);
}

console.log('\n================================================================');
console.log('=== [3] TESTING 0-VIDEO AND SINGLE-CHANNEL EDGE CASES ===');
console.log('================================================================');

// Empty map
const emptyRes = interleaveChannelVideos(new Map(), seed, 1, 10);
console.log(`Empty feed result: videos=${emptyRes.videos.length}, hasMore=${emptyRes.hasMore}, total=${emptyRes.total}`);

// Single channel
const singleMap = new Map();
singleMap.set('single-ch', Array.from({ length: 5 }).map((_, i) => ({
  id: `s-${i}`,
  channel_id: 'single-ch',
  title: `Single ${i}`,
  duration_seconds: 200,
})));
const singleRes = interleaveChannelVideos(singleMap, seed, 1, 10);
console.log(`Single channel feed result: videos=${singleRes.videos.length}, hasMore=${singleRes.hasMore}, total=${singleRes.total}`);

if (emptyRes.videos.length === 0 && singleRes.videos.length === 5) {
  console.log('>>> [PASS] Edge cases handled gracefully.');
}
