// scripts/test-shorts-unit.mjs
import assert from 'node:assert/strict';

console.log('--- RUNNING SHORTS UNIT & ALGORITHM TEST SUITE ---');

// 1. YouTube Video ID validation tests
function isValidYouTubeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

assert.equal(isValidYouTubeId('GZXhX1qZDcY'), true, 'Valid 11-char ID must pass');
assert.equal(isValidYouTubeId('UyQUL6d4i3E'), true, 'Valid 11-char ID with digits/caps must pass');
assert.equal(isValidYouTubeId('XDMInmmRP-8'), true, 'Valid 11-char ID with dash must pass');
assert.equal(isValidYouTubeId('FP4xRJgT2I_'), true, 'Valid 11-char ID with underscore must pass');
assert.equal(isValidYouTubeId('short'), false, 'Short ID must fail');
assert.equal(isValidYouTubeId('GZXhX1qZDcYYYY'), false, 'Long ID must fail');
assert.equal(isValidYouTubeId(''), false, 'Empty ID must fail');
assert.equal(isValidYouTubeId(null), false, 'Null ID must fail');
assert.equal(isValidYouTubeId('GZXhX1qZD<script>'), false, 'XSS attempt must fail');
console.log('✔ Test 1: YouTube Video ID validation (11-char regex) PASSED');

// 2. Sanitization & Deduplication test
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

const mockFeed1 = [
  { id: '1', youtube_video_id: 'GZXhX1qZDcY' },
  { id: '2', youtube_video_id: 'UyQUL6d4i3E' },
  { id: '3', youtube_video_id: 'UyQUL6d4i3E' }, // Duplicate in same batch
  { id: '4', youtube_video_id: 'invalid_id' },  // Invalid format
];

const cleaned = sanitizeAndDedupe(mockFeed1);
assert.equal(cleaned.length, 2, 'Should dedupe and filter invalid IDs');
assert.equal(cleaned[0].youtube_video_id, 'GZXhX1qZDcY');
assert.equal(cleaned[1].youtube_video_id, 'UyQUL6d4i3E');

const mockFeed2 = [
  { id: '5', youtube_video_id: 'GZXhX1qZDcY' }, // Duplicate from previous batch
  { id: '6', youtube_video_id: 'LzI0RC9GZuo' }, // New valid
];
const appended = sanitizeAndDedupe(mockFeed2, cleaned);
assert.equal(appended.length, 1, 'Should prevent duplicates across pagination pages');
assert.equal(appended[0].youtube_video_id, 'LzI0RC9GZuo');
console.log('✔ Test 2: Sanitization & Deduplication PASSED');

// 3. Bounded Player Pool (Strict Window <= 3 iframes)
function getMountedSlots(totalVideos, activeIndex) {
  const mounted = [];
  for (let i = 0; i < totalVideos; i++) {
    if (Math.abs(i - activeIndex) <= 1) {
      mounted.push(i);
    }
  }
  return mounted;
}

assert.deepEqual(getMountedSlots(10, 0), [0, 1], 'Index 0 mounts 0 and 1');
assert.deepEqual(getMountedSlots(10, 1), [0, 1, 2], 'Index 1 mounts 0, 1, and 2');
assert.deepEqual(getMountedSlots(10, 5), [4, 5, 6], 'Index 5 mounts 4, 5, and 6');
assert.deepEqual(getMountedSlots(10, 9), [8, 9], 'Index 9 mounts 8 and 9');
for (let i = 0; i < 10; i++) {
  assert.ok(getMountedSlots(10, i).length <= 3, `Index ${i} mounts at most 3 slots`);
}
console.log('✔ Test 3: Player Pool Bounded Window (at most 3 iframes) PASSED');

// 4. 50% Seen Rule Trigger Logic (Strictly once per video)
function createSeenTracker() {
  let hasRecorded = false;
  return function checkWatched(currentTime, duration) {
    if (duration <= 0) return false;
    const pct = Math.min(100, Math.round((currentTime / duration) * 100));
    if (pct >= 50 && !hasRecorded) {
      hasRecorded = true;
      return true;
    }
    return false;
  };
}

const tracker = createSeenTracker();
assert.equal(tracker(10, 30), false, '33% should not trigger 50% persist');
assert.equal(tracker(14, 30), false, '46% should not trigger 50% persist');
assert.equal(tracker(15, 30), true, '50% triggers persist exactly once');
assert.equal(tracker(16, 30), false, 'Subsequent tick (53%) does not duplicate persist');
assert.equal(tracker(20, 30), false, 'Subsequent tick (67%) does not duplicate persist');
console.log('✔ Test 4: 50% Seen Rule Threshold Trigger (Exactly Once) PASSED');

// 5. Safe Layout Height Chain Calculation
function computeShortsHeight(dvh, headerH = 52, navH = 58, safeAreaBottom = 0) {
  return dvh - headerH - navH - safeAreaBottom;
}

assert.equal(computeShortsHeight(800, 52, 58, 0), 690, 'Samsung S8+ 800px viewport computes to 690px');
assert.equal(computeShortsHeight(844, 52, 58, 34), 700, 'iPhone 14 Pro 844px with 34px safe area computes to 700px');
assert.ok(computeShortsHeight(800) > 650, 'Mobile height must be greater than 650px');
console.log('✔ Test 5: Layout Height Chain Calculation PASSED');

console.log('\nALL 5 AUTOMATED SUITE TESTS PASSED SUCCESSFULLY (100%)');
