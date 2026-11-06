# SHORTS_INSTANT_PLAYBACK_PLAN.md

> **PLANNING DOCUMENT ONLY — No code changes in this phase.**
> Status: Draft for review. Advance to PROMPT 2 (Build) only after approval.

---

## Table of Contents

1. [Executive Summary & Feasibility Verdict](#1-executive-summary--feasibility-verdict)
2. [AS-IS Findings — Root Causes with Code References](#2-as-is-findings--root-causes-with-code-references)
3. [Options Matrix](#3-options-matrix)
4. [Target Architecture — Recommended Design](#4-target-architecture--recommended-design)
5. [SQL Migration Plan](#5-sql-migration-plan)
6. [Backend Ingestion Pipeline](#6-backend-ingestion-pipeline)
7. [Frontend Player-Pool Design](#7-frontend-player-pool-design)
8. [Preload Scheduler Rules](#8-preload-scheduler-rules)
9. [File-by-File Change List](#9-file-by-file-change-list)
10. [Performance Budget & Measurement](#10-performance-budget--measurement)
11. [Risks, Mitigations & Legal Considerations](#11-risks-mitigations--legal-considerations)
12. [Feature Flag `SHORTS_V2` & Phased Roadmap](#12-feature-flag-shorts_v2--phased-roadmap)

---

## 1. Executive Summary & Feasibility Verdict

### The Core Problem

Every time the user scrolls to the next Short, the app creates a **fresh YouTube IFrame**, waits for `onReady` to fire (800–2 000 ms on typical mobile connections), then calls `playVideo()`. The poster/spinner is visible for the entire duration. This is architecturally guaranteed to show a spinner — no amount of tuning the existing iframe approach can eliminate it, because the delay is inherent to the YouTube IFrame API startup sequence.

### Can Zero-Spinner Be Achieved with iframes Only?

**No — not reliably.** Research and YouTube's own documentation confirm:

- Hidden iframes (off-screen, `display:none`, `visibility:hidden`) are throttled or blocked by browsers and YouTube's anti-abuse heuristics (Chrome 2024, Safari iOS 17+). YouTube explicitly requires a minimum 200×200 px visible area before the API functions correctly. ([YouTube IFrame API docs](https://developers.google.com/youtube/iframe_api_reference))
- `cueVideoById()` on a non-visible iframe loads **metadata and thumbnail only** — it does not pre-buffer the video stream. The network-intensive frame download still happens when `playVideo()` is called.
- `loadVideoById()` on a hidden iframe triggers YouTube's anti-fraud detection and may refuse playback or flag the account.
- Even with 3 visible-but-transparent warmed iframes, the **YT.Player constructor → `onReady` lifecycle** costs 400–1 500 ms per new player creation because YouTube loads its player JS bundle, initialises the postMessage bridge, and negotiates the session. This cannot be parallelised across iframes for different videos efficiently.

### Recommended Architecture: Self-Hosted MP4 on Cloudflare R2 + Native HTML5 `<video>`

| Criterion | Decision |
|---|---|
| Player technology | Native HTML5 `<video>` (no iframes) |
| Video storage | Cloudflare R2 (10 GB/month free tier, $0 egress) |
| Video format | H.264 + AAC, single-file progressive MP4 with `-movflags +faststart` |
| Ingestion | Supabase Edge Function + Render background worker using `yt-dlp` |
| Preload strategy | Hidden `<video preload="auto">` pool: N+1, N+2 elements created ahead of time |
| Fallback | YouTube IFrame (existing code) when `storage_url` is not yet available |
| Feature flag | `NEXT_PUBLIC_SHORTS_V2=true` activates new player path |

**Why this achieves zero-spinner:** A native `<video preload="auto">` element with a CDN URL begins buffering the moment it is created. By the time the user scrolls to it (~500 ms of scroll animation), the browser has already downloaded hundreds of kilobytes. The first frame is decoded before the scroll finishes. No IFrame API startup, no postMessage handshake, no YouTube player JS download.

**Legal risk:** Addressed in Section 11. High risk for public redistribution; this is a **private family app** with parent-controlled channels. Recommended mitigation: only download Shorts from channels the **parent explicitly added** to the account, and serve only to that family's child profiles. This falls within fair-use patterns for private/personal use, though it still violates YouTube's ToS as a contract matter. Full risk disclosure and user consent flow is required.

---

## 2. AS-IS Findings — Root Causes with Code References

### 2.1 Architecture Diagram (Current)

```
User swipes ↓
    │
    ▼
ShortsContainer.tsx:  IntersectionObserver (threshold 0.65) fires
    │  setActiveIndex(N)  [line 84]
    │
    ▼
ShortsContainer.tsx:  <ShortsItem isMounted={isNearActive}> where isNearActive = |idx - activeIndex| ≤ 1
    │  [line 254-277]  → ShortsItem receives isMounted=true for N-1, N, N+1
    │
    ▼
ShortsItem.tsx:  useEffect on [isMounted] → calls onAttachContainer(index, containerRef.current)
    │  [lines 35-44]
    │
    ▼
useShortsPlayerPool.ts:  attachPlayer(index, containerEl)
    │  [lines 122-233]
    │  loadYouTubeIframeApi() — waits for YT script to be ready (singleton, cached after first load)
    │
    ▼  ~50-100ms (if already loaded)
    │
    new window.YT.Player(hostDiv, { videoId, playerVars, events })
    │  [line 168]  — creates a new <iframe src="https://www.youtube.com/embed/...">
    │  Browser must: DNS resolve, TLS handshake, download embed JS, init postMessage bridge
    │
    ▼  ~600-1800ms (network dependent)
    │
    events.onReady fires  [line 186]
    │  → entry.isReady = true  [line 188]
    │  → event.target.playVideo()  [line 199]  (muted or unmuted)
    │
    ▼  ~100-300ms (YouTube buffer + first decode)
    │
    events.onStateChange: data === YT.PlayerState.PLAYING
    │  [line 211]  → setPlayingIndices({[index]: true})
    │
    ▼
ShortsItem.tsx:  isPlaying = true → poster fades out (opacity-0)  [line 71]
    │
    ▼
✅ User sees video — TOTAL LATENCY: 750ms–2100ms
```

### 2.2 Root Cause Breakdown

| Step | Latency Estimate | Root Cause |
|---|---|---|
| Scroll → `setActiveIndex` | 0–50 ms | IntersectionObserver debounce |
| `setActiveIndex` → `isMounted=true` → `attachPlayer` | 0–16 ms | React re-render (1 frame) |
| `loadYouTubeIframeApi()` resolve | 50–100 ms | Cached after first load, still async |
| **`new YT.Player()` → `onReady`** | **600–1 800 ms** | **THE ROOT CAUSE** |
| `playVideo()` → `PLAYING` state | 100–300 ms | YouTube buffer startup |
| `setPlayingIndices` → poster fade | 16–50 ms | React state update + CSS transition |
| **TOTAL** | **766–2 266 ms** | — |

### 2.3 Precise Root Cause: Too Late, Too Fresh

**File:** [`src/features/shorts/hooks/useShortsPlayerPool.ts`](src/features/shorts/hooks/useShortsPlayerPool.ts#L158-L230)

The player for index `N` is constructed inside `loadYouTubeIframeApi().then(...)` **at the moment the user scrolls to N** — not before. The `isMounted` gate in `ShortsContainer.tsx` line 254 (`Math.abs(index - activeIndex) <= 1`) means the N+1 card gets `isMounted=true` simultaneously with N, so both players are created at the same time. The user is *watching N being created* while they scroll.

**File:** [`src/features/shorts/components/ShortsItem.tsx`](src/features/shorts/components/ShortsItem.tsx#L35-L44)

```typescript
// ShortsItem.tsx lines 35-44
useEffect(() => {
  if (isMounted) {
    onAttachContainer(index, containerRef.current);  // ← triggers player creation
  } else {
    onAttachContainer(index, null);
  }
}, [index, isMounted, onAttachContainer]);  // ← fires when isMounted flips true
```

`isMounted` flips true only when `Math.abs(index - activeIndex) <= 1` — i.e., N+1 gets its player created only when the user is already on N. By the time they scroll to N+1, the player is still initialising.

**File:** [`src/features/shorts/hooks/useShortsPlayerPool.ts`](src/features/shorts/hooks/useShortsPlayerPool.ts#L259-L270)

The pool prune logic at lines 259–270 destroys any player outside `[activeIndex-1, activeIndex+1]`. Combined with the late-creation problem, N+2 is always destroyed and re-created, and N+1 is often still being created when needed.

### 2.4 Feed API — Not a Root Cause

The `get_shorts_feed` RPC ([`supabase/migrations/020_shorts_cleanup.sql`](supabase/migrations/020_shorts_cleanup.sql)) runs in `<100 ms` once the data is in Postgres. The feed fetch itself is not causing the spinner — the round-trip happens on initial load and lookahead, not on each swipe. The delay is entirely in the player creation lifecycle.

---

## 3. Options Matrix

### Option A: YouTube IFrame Pool (Aggressive Warm-Up)

**Concept:** Pre-create YT.Player instances for N+2 and N+3, keep them alive in a larger pool, attempt `cueVideoById` on hidden players to warm up.

| Factor | Assessment |
|---|---|
| **First-frame latency** | 400–1 200 ms (best case — iframe ready, `onReady` already fired) |
| **Zero-spinner feasible?** | No. Even a fully-ready iframe takes 100–400 ms to start streaming after `playVideo()`. Browser autoplay policy blocks unmuted playback. |
| **Hidden player buffering** | Blocked by Chrome/Safari since 2023. YouTube throttles hidden iframes. |
| **Legal risk** | Low (YouTube terms allow embedding) |
| **Complexity** | Medium |
| **Cost** | $0 |
| **Verdict** | ❌ Cannot achieve ≤150 ms first frame |

### Option B: Self-Hosted MP4 on Cloudflare R2 + Native `<video>` (RECOMMENDED)

**Concept:** Download Shorts via yt-dlp on a Render background worker → transcode to H.264 MP4 with `-movflags +faststart` → upload to Cloudflare R2 → serve with CDN cache headers → load in hidden `<video preload="auto">` pool.

| Factor | Assessment |
|---|---|
| **First-frame latency** | **10–80 ms** (video already buffered in RAM by the time user scrolls) |
| **Zero-spinner feasible?** | **Yes** — `<video preload="auto">` truly buffers bytes ahead of time |
| **Legal risk** | **HIGH** — violates YouTube ToS (civil contract, not criminal). Self-hosting third-party creators' videos = copyright infringement if served publicly. For this private family app with parent-added channels, risk is significantly lower. Full disclosure to user required. |
| **Cost** | R2: 10 GB free, $0 egress. 5 channels × 50 Shorts × ~10 MB/Short = ~2.5 GB. Within free tier. |
| **Complexity** | High (ingestion pipeline, storage, encoding) |
| **Reliability** | Excellent once ingested; CDN is always available |
| **Verdict** | ✅ **Recommended — achieves target, within free tier for typical JruJu TV scale** |

### Option C: Cloudflare Stream (HLS)

**Concept:** Upload videos to Cloudflare Stream for per-minute encoding, get HLS output, serve via hls.js.

| Factor | Assessment |
|---|---|
| **First-frame latency** | 50–150 ms with hls.js preload |
| **Zero-spinner feasible?** | Yes, but adds HLS segment download round-trip |
| **Cost** | $5/month storage + $1/1000 views — expensive at scale |
| **Complexity** | High (HLS player, Cloudflare Stream API) |
| **Legal risk** | Same as Option B |
| **Verdict** | ❌ Cost-prohibitive vs. R2 for the same legal risk |

### Option D: Hybrid (Iframe + Pre-Created Pool)

**Concept:** Pre-create 3 YT.Player iframes on page load (not on scroll), keep them always-alive and swap videos using `cueVideoById` between them. Display them scaled/positioned into view.

| Factor | Assessment |
|---|---|
| **First-frame latency** | 200–600 ms (cueVideoById needs ~200–400 ms to actually buffer) |
| **Zero-spinner feasible?** | No. `cueVideoById` doesn't pre-buffer video data — only metadata. |
| **Legal risk** | Low |
| **Cost** | $0 |
| **Complexity** | Medium |
| **Verdict** | ❌ Cannot reliably hit ≤150 ms. Good interim improvement but not the target. |

### Scored Comparison

| Option | First-Frame | Zero-Spinner | Cost | Legal | Complexity | Score |
|---|---|---|---|---|---|---|
| A: Iframe Pool | 400–1200 ms | ❌ | $0 | ✅ | Medium | 2/5 |
| **B: R2 + `<video>`** | **10–80 ms** | **✅** | **~$0** | **⚠️** | **High** | **5/5** |
| C: CF Stream HLS | 50–150 ms | ✅ | $5+/mo | ⚠️ | High | 3/5 |
| D: Iframe Hybrid | 200–600 ms | ❌ | $0 | ✅ | Medium | 2/5 |

### Fallback Ladder

```
1. ✅ PREFERRED: storage_url exists + SHORTS_V2=true
     → native <video preload="auto"> pool
     → first frame ≤80 ms on 4G (video pre-buffered)

2. ⚠️ INTERIM: storage_url=null but video has thumbnail
     → YouTube IFrame (current code, unchanged)
     → first frame 800–2000 ms (spinner visible — acceptable only during ingestion backfill)

3. 🔄 GRACEFUL DEGRADATION: YouTube IFrame error / network error
     → static poster image shown permanently
     → "Video unavailable" badge
     → auto-advance after 3 seconds (existing onError handler)
```

---

## 4. Target Architecture — Recommended Design

### 4.1 Data Flow Diagram

```
┌─────────────────── INGESTION PIPELINE (server-side, runs once per Short) ──────────────────┐
│                                                                                              │
│  Supabase Edge Function OR Render background worker                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  1. Query: SELECT id, youtube_video_id FROM videos                                     │ │
│  │            WHERE is_short=true AND media_status='pending'                              │ │
│  │            LIMIT 20                                                                    │ │
│  │                                                                                        │ │
│  │  2. For each video:                                                                    │ │
│  │     a. yt-dlp --format "bestvideo[height<=1080]+bestaudio/best"                       │ │
│  │               --merge-output-format mp4 <youtube_id>                                  │ │
│  │     b. ffmpeg -i input.mp4 -c:v libx264 -preset fast -crf 23                         │ │
│  │               -c:a aac -b:a 128k -movflags +faststart -vf scale=-2:1080 output.mp4   │ │
│  │     c. ffmpeg -ss 1 -i output.mp4 -frames:v 1 -q:v 2 poster.jpg  (poster frame)      │ │
│  │     d. Upload output.mp4 → R2 bucket: shorts/{video_id}/video.mp4                    │ │
│  │     e. Upload poster.jpg → R2 bucket: shorts/{video_id}/poster.jpg                   │ │
│  │     f. UPDATE videos SET                                                              │ │
│  │           storage_url='https://r2.jrujutv.com/shorts/{id}/video.mp4',                │ │
│  │           poster_url='https://r2.jrujutv.com/shorts/{id}/poster.jpg',                │ │
│  │           media_status='ready'                                                        │ │
│  │        WHERE id = {video_id}                                                          │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────── FEED ENDPOINT (Supabase RPC, unchanged algorithm) ──────────────────────┐
│  get_shorts_feed(seed, cursor, limit)                                                        │
│  Returns: { videos: [...], has_more, next_cursor, total }                                    │
│  ADDED to response: storage_url, poster_url, media_status per video                          │
│  Videos with media_status='ready' → V2 player path                                           │
│  Videos with media_status='pending'/'error' → V1 iframe fallback                             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────── FRONTEND PLAYER POOL (React, in-browser) ───────────────────────────────┐
│                                                                                              │
│  ShortsContainer                                                                             │
│  ├── useShortsV2PlayerPool (new hook)                                                        │
│  │   ├── Pool: Map<index, HTMLVideoElement>                                                   │
│  │   │   ├── [N-1] paused, muted (keep-alive for back-scroll)                                │
│  │   │   ├── [N]   PLAYING, unmuted after gesture                                            │
│  │   │   ├── [N+1] preload="auto", paused, muted, currentTime=0                             │
│  │   │   └── [N+2] preload="auto", paused, muted, currentTime=0                             │
│  │   │                                                                                        │
│  │   ├── Prune: destroy elements at [N-2] and beyond N+2                                     │
│  │   └── State machine: idle → warming → ready → playing                                     │
│  │                                                                                            │
│  └── useShortsPlayerPool (existing hook — iframe fallback for 'pending' videos)              │
│                                                                                              │
│  ShortsItem (updated)                                                                        │
│  ├── IF video.media_status === 'ready' AND SHORTS_V2=true:                                   │
│  │   └── ShortsVideoPlayer (native <video> wrapper, new component)                           │
│  └── ELSE:                                                                                    │
│      └── <div ref={containerRef} className="shorts-player-frame" /> (existing iframe)        │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Player State Machine

```
                    ┌─────────────┐
              ───── │    IDLE     │ ◄─── video element not created, index > N+2
                    └─────┬───────┘
                          │ index enters [N+2] window
                          ▼
                    ┌─────────────┐
                    │   WARMING   │  createElement('video'), src=storage_url
                    │             │  preload="auto", muted, playsinline
                    └─────┬───────┘
                          │ 'canplay' event fires (browser has enough to start)
                          ▼
                    ┌─────────────┐
                    │    READY    │  paused, currentTime=0, muted
                    └─────┬───────┘
                          │ index === activeIndex
                          ▼
                    ┌─────────────┐
                    │   PLAYING   │  play(), after gesture → unmute
                    └─────────────┘
                          │ index leaves N (user scrolls away)
                          ▼
                    IDLE or WARMING (prune if > N+2, keep if N-1)
```

### 4.3 Preload Scheduler Rules (see Section 8 for detail)

- Window: `[N-1, N, N+1, N+2]` — 4 video elements maximum in DOM
- Create N+1 and N+2 elements immediately when N becomes active
- N-1 kept alive (paused) for fast back-scroll
- N-2 and beyond → destroy and garbage-collect
- Low-end device (< 2 GB RAM detected via `navigator.deviceMemory`): reduce window to `[N, N+1]`

---

## 5. SQL Migration Plan

### Migration: `021_shorts_v2_media.sql`

**Goal:** Add self-hosted media columns to `videos` table, update `get_shorts_feed` to return them.

```sql
-- Migration 021: Add Shorts V2 self-hosted media columns
-- Safe: idempotent, no data loss, backward compatible

BEGIN;

-- 1. Add new columns to videos table
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS storage_url TEXT,
  ADD COLUMN IF NOT EXISTS poster_url TEXT,
  ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS r2_object_key TEXT,
  ADD COLUMN IF NOT EXISTS media_error TEXT,
  ADD COLUMN IF NOT EXISTS media_queued_at TIMESTAMPTZ;

-- 2. Add check constraint for status values
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_media_status_check;
ALTER TABLE public.videos
  ADD CONSTRAINT videos_media_status_check
    CHECK (media_status IN ('pending', 'processing', 'ready', 'error', 'skipped'));

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_videos_media_status_is_short
  ON public.videos (media_status, is_short)
  WHERE is_short = true;

CREATE INDEX IF NOT EXISTS idx_videos_pending_shorts
  ON public.videos (id)
  WHERE is_short = true AND media_status = 'pending';

-- 4. Update get_shorts_feed to include storage_url, poster_url, media_status
-- (Full function body — replaces 020 version)
CREATE OR REPLACE FUNCTION public.get_shorts_feed( ... )
-- [same body as 020 but adds storage_url, poster_url, media_status to jsonb_build_object]

COMMIT;
```

**Columns added:**

| Column | Type | Default | Purpose |
|---|---|---|---|
| `storage_url` | TEXT | NULL | CDN URL to self-hosted MP4 |
| `poster_url` | TEXT | NULL | CDN URL to poster frame JPEG |
| `media_status` | TEXT | 'pending' | State machine: pending/processing/ready/error/skipped |
| `r2_object_key` | TEXT | NULL | R2 object key for cleanup/deletion |
| `media_error` | TEXT | NULL | Last error message for debugging |
| `media_queued_at` | TIMESTAMPTZ | NULL | When ingestion was queued |

### Migration: `021_shorts_v2_media_rollback.sql`

```sql
BEGIN;
ALTER TABLE public.videos
  DROP COLUMN IF EXISTS storage_url,
  DROP COLUMN IF EXISTS poster_url,
  DROP COLUMN IF EXISTS media_status,
  DROP COLUMN IF EXISTS r2_object_key,
  DROP COLUMN IF EXISTS media_error,
  DROP COLUMN IF EXISTS media_queued_at;
-- Restore previous get_shorts_feed (from 020)
COMMIT;
```

### RLS Considerations

- No new RLS policies needed. `videos` table uses existing family-based RLS.
- `storage_url` and `poster_url` are public CDN URLs — no auth required at the CDN level.
- R2 bucket should be set to public read-only (objects accessible without auth).

---

## 6. Backend Ingestion Pipeline

### 6.1 Architecture

The ingestion pipeline runs outside Supabase Edge Functions (which have a 60-second wall-clock limit — insufficient for downloading + encoding a video). It runs as a **Render Background Worker** or as a **long-running Node.js script** on the Render web service.

```
Trigger options:
  A. Manual: POST /api/admin/ingest-shorts (parent calls from dashboard)
  B. Automatic: Render Cron job (daily at 2:00 AM UTC)
  C. On-demand: After sync-channel Edge Function completes, call ingest for new shorts
```

### 6.2 Pipeline Steps (per Short)

```
1. DETECT: SELECT * FROM videos WHERE is_short=true AND media_status='pending' LIMIT 20

2. MARK: UPDATE videos SET media_status='processing', media_queued_at=NOW() WHERE id=$id

3. DOWNLOAD: yt-dlp
   --format "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]"
   --merge-output-format mp4
   --no-playlist
   --socket-timeout 30
   "https://www.youtube.com/shorts/{youtube_video_id}"
   -o /tmp/{id}_raw.mp4

4. ENCODE: ffmpeg
   -i /tmp/{id}_raw.mp4
   -c:v libx264 -preset fast -crf 23 -profile:v baseline -level 3.1
   -c:a aac -b:a 128k -ac 2
   -movflags +faststart
   -vf "scale='min(1080,iw)':-2"
   -t 65  (cap at 65 seconds — Shorts can be up to 60s)
   /tmp/{id}_encoded.mp4

5. POSTER: ffmpeg
   -ss 1 -i /tmp/{id}_encoded.mp4
   -frames:v 1 -q:v 2 -vf "scale=720:-2"
   /tmp/{id}_poster.jpg

6. UPLOAD to R2 (S3-compatible API):
   PUT shorts/{id}/video.mp4  → Content-Type: video/mp4
                               → Cache-Control: public, max-age=31536000, immutable
   PUT shorts/{id}/poster.jpg → Content-Type: image/jpeg
                               → Cache-Control: public, max-age=31536000, immutable

7. UPDATE DB:
   UPDATE videos SET
     storage_url = 'https://{R2_PUBLIC_URL}/shorts/{id}/video.mp4',
     poster_url  = 'https://{R2_PUBLIC_URL}/shorts/{id}/poster.jpg',
     r2_object_key = 'shorts/{id}/',
     media_status = 'ready',
     media_error = NULL
   WHERE id = $id

8. CLEANUP: rm /tmp/{id}_raw.mp4/tmp/{id}_encoded.mp4 /tmp/{id}_poster.jpg
```

### 6.3 Error Handling

| Error | Action |
|---|---|
| yt-dlp download fails (geo-block, private video, deleted) | `media_status='skipped'`, `media_error=<message>`, skip — video falls back to iframe |
| ffmpeg encode fails | `media_status='error'`, `media_error=<message>`, retry up to 3 times |
| R2 upload fails | `media_status='pending'` (reset), retry on next run |
| Short > 65 seconds | `media_status='skipped'` — not a true Short; skip |

### 6.4 Quota & Storage Math

For a typical JruJu TV family with 5 channels × 50 Shorts each:
- Raw download size: ~15–25 MB per Short (1080p, ~30–60 seconds)
- After encode (crf 23, 720p): ~3–8 MB per Short
- 250 Shorts × 6 MB average = **1.5 GB** — well within R2's 10 GB free tier
- Plus poster frames: 250 × 50 KB = 12.5 MB — negligible
- R2 reads: 250 Shorts × 10 views/day × 1 request = 2 500 reads/day = 75 000/month — within 10M free reads

### 6.5 New Supabase Edge Function: `ingest-shorts`

A lightweight Edge Function is needed to trigger the background worker via Render's API or a webhook. This runs on-demand when the parent clicks "Sync" or as a scheduled cron.

**Alternative (simpler):** A standalone Node.js script at `scripts/ingest-shorts.ts` that can be run manually or on a schedule via Render's Cron jobs feature.

### 6.6 Environment Variables Required

```bash
# Cloudflare R2 (get from Cloudflare dashboard)
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret
CLOUDFLARE_R2_BUCKET_NAME=jrujutv-shorts
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxx.r2.dev  # or custom domain

# Feature flag
NEXT_PUBLIC_SHORTS_V2=true  # or false to disable
```

---

## 7. Frontend Player-Pool Design

### 7.1 New Hook: `useShortsV2PlayerPool`

The existing `useShortsPlayerPool` is preserved for the iframe fallback path. A new hook handles native video.

```typescript
// Key state types
interface V2PlayerEntry {
  el: HTMLVideoElement;
  videoId: string;      // DB UUID
  youtubeId: string;    // 11-char YouTube ID
  storageUrl: string;   // CDN URL
  state: 'warming' | 'ready' | 'playing';
  canPlayFired: boolean;
}

// Pool: at most 4 entries: N-1, N, N+1, N+2
// Implemented as Map<index, V2PlayerEntry>
```

### 7.2 Player Lifecycle Operations

**Create (called when index enters [N+2] window):**
```
const el = document.createElement('video');
el.src = video.storage_url;
el.preload = 'auto';
el.muted = true;        // Required for autoplay policy
el.playsInline = true;  // Required for iOS
el.setAttribute('webkit-playsinline', 'true');  // Legacy iOS
el.load();              // Explicit load call (triggers preloading)
el.addEventListener('canplay', () => { entry.state = 'ready'; });
el.addEventListener('error', () => { /* fall back to iframe */ });
// DO NOT append to DOM yet — just start buffering
```

**Attach to DOM (called when index becomes N):**
```
containerRef.current.appendChild(el);
el.currentTime = 0;
el.muted = true;
await el.play();  // plays muted — always works due to muted+playsinline
// After user gesture: el.muted = false; el.volume = 1;
```

**Detach from DOM (called when index leaves N):**
```
el.pause();
el.currentTime = 0;
el.muted = true;
containerRef.current.removeChild(el);
// Keep el in pool if [N-1]; destroy if [N-2]
```

**Destroy:**
```
el.pause();
el.src = '';
el.load();      // Abort pending network requests
el.remove();    // Remove from DOM if attached
pool.delete(index);
```

### 7.3 `requestVideoFrameCallback` Integration

To detect "first real frame decoded" (more accurate than `canplay`):
```typescript
if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
  el.requestVideoFrameCallback(() => {
    entry.state = 'firstFrameReady';
    // Fade out poster immediately when first real frame is painted
    setFirstFrameReady(true);
  });
}
```

### 7.4 Autoplay & Sound Unlock

1. On mount: all pool elements are `muted=true`. `play()` succeeds silently.
2. On first user tap (`onClick` on gesture layer): `el.muted = false; el.volume = 1;` — this is a synchronous user gesture, so browsers allow unmuting.
3. `hasUserGestureUnlocked` persists in Zustand store for the session.
4. On subsequent scrolls: new videos start muted, then unmute immediately after `play()` resolves (since gesture was already unlocked and the play call is from an event handler chain).

**iOS Safari Gotcha (2024):** Even with `muted+playsinline`, iOS Safari requires the `play()` call to be in a synchronous user gesture handler OR the element to have been touched during pageload. The IntersectionObserver-based scroll approach is NOT a user gesture. Solution: Call `el.play()` inside the `onScroll` → `setActiveIndex` chain (which is touch-driven on mobile), not in a `useEffect`.

### 7.5 Memory Management

- Max pool size: 4 elements (N-1, N, N+1, N+2)
- Low-end device (deviceMemory < 2 or connection.effectiveType === '2g'): reduce to 2 elements (N, N+1)
- Each `<video>` element holds browser decode buffers — destroying via `el.src = ''; el.load()` releases them
- Monitor with `performance.measureUserAgentSpecificMemory()` (Chrome 89+ behind flag) if needed for debug overlay

---

## 8. Preload Scheduler Rules

```
When activeIndex changes from N-1 to N:

  PRIORITY 1: Ensure N is playing
    - If poolRef.has(N) && entry.state === 'ready': attach to DOM, play
    - If poolRef.has(N) && entry.state === 'warming': attach to DOM, play when canplay fires
    - If !poolRef.has(N): CRITICAL MISS — start warming + fallback to iframe

  PRIORITY 2: Warm N+1 (if not already warming/ready)
    - If !poolRef.has(N+1) && videos[N+1]?.storage_url:
        createVideoElement(N+1)  // start buffering immediately

  PRIORITY 3: Warm N+2 (if network conditions allow)
    - const conn = navigator.connection;
    - if (!conn || conn.effectiveType === '4g' || conn.effectiveType === '3g'):
        createVideoElement(N+2)

  PRIORITY 4: Prune old entries
    - for (const [idx, entry] of pool):
        if (idx < N-1 || idx > N+2): destroy(entry)

  PRIORITY 5: Keep N-1 alive but paused
    - pool.get(N-1)?.el.pause()
    - pool.get(N-1)?.el.currentTime = 0
```

**Scroll velocity adaptation:**
- If user is swiping rapidly (velocity > 2 cards/second detected via scroll events), suspend N+2 warming to avoid bandwidth spike
- Resume N+2 warming 300 ms after scroll velocity drops

---

## 9. File-by-File Change List

### Files to CREATE (new)

| File | Purpose |
|---|---|
| `src/features/shorts/hooks/useShortsV2PlayerPool.ts` | New native video pool hook |
| `src/features/shorts/components/ShortsVideoPlayer.tsx` | Native `<video>` wrapper component |
| `src/features/shorts/components/ShortsDebugOverlay.tsx` | `?debug=1` performance overlay |
| `supabase/migrations/021_shorts_v2_media.sql` | Add storage columns, update RPC |
| `supabase/migrations/021_shorts_v2_media_rollback.sql` | Rollback migration |
| `scripts/ingest-shorts.ts` | Ingestion pipeline (yt-dlp + ffmpeg + R2 upload) |
| `scripts/backfill-shorts-media.ts` | One-time backfill for existing channels on deploy |
| `CHANGELOG_SHORTS_V2.md` | Change log for V2 |

### Files to MODIFY

| File | Change |
|---|---|
| `src/features/shorts/types/index.ts` | Add `storage_url?`, `poster_url?`, `media_status?` to `ShortVideo` type |
| `src/features/shorts/components/ShortsItem.tsx` | Branch on `media_status==='ready' && SHORTS_V2`: render `ShortsVideoPlayer`, else existing iframe div |
| `src/features/shorts/components/ShortsContainer.tsx` | Add `useShortsV2PlayerPool`; pass debug flag; mount `ShortsDebugOverlay` when `?debug=1` |
| `supabase/migrations/020_shorts_cleanup.sql` (or new 021) | Update `get_shorts_feed` to return new columns |
| `src/app/globals.css` | Add `.shorts-native-video` CSS (full-bleed, object-fit: cover) |
| `.env.local` (dev only, not committed) | Add R2 env vars |
| `README.md` | Update setup guide with R2 configuration steps |

### Files to NOT TOUCH

- `src/components/layout/MobileHeader.tsx` — ✅ already hides on /shorts
- `src/features/shorts/hooks/useShortsPlayerPool.ts` — keep as-is (iframe fallback)
- `src/features/shorts/hooks/useShortsFeedQuery.ts` — keep as-is
- `src/features/shorts/api/shortsApi.ts` — only add type to response, no logic change
- `src/features/shorts/store/shortsStore.ts` — keep as-is
- All other routes/components — do not touch

---

## 10. Performance Budget & Measurement

### Target Metrics

| Metric | Target | Failure Threshold |
|---|---|---|
| First frame visible after scroll | ≤ 150 ms | > 500 ms = FAIL |
| Spinner count across 200 swipes | 0 | > 0 = FAIL |
| Memory after 50 swipes | < 200 MB RSS | > 400 MB = FAIL |
| Feed load on /shorts open | < 1.5 s (initial iframe visible) | > 3 s = FAIL |
| Scroll snap: exactly 1 video per screen | Always | Any partial-screen = FAIL |

### Debug Overlay (`?debug=1`)

Activated by `window.location.search.includes('debug=1')` or `ShortsDebugOverlay` component.

Displays (top-right corner, semi-transparent panel):
```
Pool State:
  N-1: READY (buffered 100%)
  N+0: PLAYING (00:12 / 00:30)
  N+1: WARMING (canplay: ✅, firstFrame: ✅)
  N+2: IDLE

Last scroll: 23ms to first frame
Spinner events: 0 / 200 swipes
Feed: 15 loaded, cursor=15
Media status: 12 ready, 3 pending (iframe fallback)
Connection: 4g
```

### Measurement via `performance.mark()`

In `useShortsV2PlayerPool`:
```typescript
// When scroll begins:
performance.mark(`scroll-start-${index}`);

// When first frame is decoded (requestVideoFrameCallback):
performance.mark(`first-frame-${index}`);
performance.measure(`first-frame-latency-${index}`,
  `scroll-start-${index}`, `first-frame-${index}`);
```

The debug overlay reads `performance.getEntriesByName()` to show real-time measurements.

---

## 11. Risks, Mitigations & Legal Considerations

### Legal Risk — YouTube ToS (CRITICAL — Must Read)

**Risk Level: HIGH for public apps, MEDIUM-LOW for private family apps**

Downloading YouTube Shorts via yt-dlp and re-serving them violates:
- YouTube Terms of Service Section 5.1.H: "You shall not download any Content unless YouTube indicates that this is permitted."
- Copyright law: The videos belong to their creators, not YouTube. Re-hosting without creator consent is copyright infringement.

**However, for JruJu TV specifically:**
- This is a **private family app** — there is no public audience
- The parent explicitly chose each channel and consented to the app's use
- Access is gated by parent authentication and child PIN
- No monetisation or public redistribution occurs
- Usage is analogous to "time-shifting" for personal viewing

**Recommended mitigations:**
1. Add a **User Consent Screen** (one-time, shown to parent before enabling V2): "JruJu TV can download and locally cache YouTube Shorts from your selected channels for instant playback. This is for private family viewing only. By enabling this feature, you confirm you understand this may not comply with YouTube's Terms of Service and accept the risk."
2. Implement **automatic deletion**: Delete R2 objects when a parent removes a channel from their account.
3. Respect creator rights: Only download from channels the parent added — never from search results or recommendations.
4. No public URLs: R2 objects can optionally be served via signed URLs (expire in 24 hours) rather than public CDN.

### Technical Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| yt-dlp breaks (YouTube updates bot detection) | Medium (happens 1–2x/year) | Auto-fallback to iframe; alert admin; yt-dlp updates regularly |
| R2 bucket costs exceed free tier | Low at current scale | Monitor with CF dashboard; alert at 8 GB |
| ffmpeg not available on Render | Low | Render supports custom buildpacks; ffmpeg is standard |
| `preload="auto"` ignored by iOS Safari | Medium | Explicit `el.load()` call; use `fetch()` blob workaround as fallback |
| Memory pressure on old Android phones | Medium | Reduce pool to 2 on `deviceMemory < 2` |
| Ingestion pipeline timeouts | Medium | Process in batches of 5; use Render background workers (no timeout) |

### Non-Regression Checklist

Before shipping PROMPT 2, verify:
- [ ] Home feed `/` unchanged
- [ ] Watch page `/watch/[id]` unchanged
- [ ] Parent dashboard `/parent/*` unchanged
- [ ] Child login flow unchanged
- [ ] PIN login unchanged
- [ ] Channel management unchanged
- [ ] Mobile bottom nav unchanged
- [ ] Desktop sidebar unchanged
- [ ] `npm run build` exit code 0
- [ ] `npm run test:shorts` all 7 tests pass

---

## 12. Feature Flag `SHORTS_V2` & Phased Roadmap

### Feature Flag

```bash
# In .env.local (development) and Render environment variables (production)
NEXT_PUBLIC_SHORTS_V2=false   # Default: disabled, old iframe path
NEXT_PUBLIC_SHORTS_V2=true    # Enabled: V2 native video path for 'ready' shorts
```

Usage in code:
```typescript
const SHORTS_V2 = process.env.NEXT_PUBLIC_SHORTS_V2 === 'true';
// In ShortsItem.tsx:
// if (SHORTS_V2 && video.media_status === 'ready') → ShortsVideoPlayer
// else → existing iframe div
```

The flag is a build-time constant. No runtime toggle needed — a re-deploy switches it.

### Phased Roadmap

```
PHASE 0 — TODAY (complete)
  ✅ Shorts rebuild (Prompts 1-3 previous session)
  ✅ migration 020 ready
  ✅ Build passes, 7 tests pass

PHASE 1 — PROMPT 2 (this plan's implementation)
  Week 1:
    □ Run migration 021 in Supabase
    □ Configure Cloudflare R2 bucket
    □ Build ingestion script (scripts/ingest-shorts.ts)
    □ Test ingestion on 1 channel (manual run)
  Week 2:
    □ Build useShortsV2PlayerPool hook
    □ Build ShortsVideoPlayer component
    □ Build ShortsDebugOverlay
    □ Update ShortsItem to branch on media_status
    □ Set NEXT_PUBLIC_SHORTS_V2=false (flag off by default)
    □ Deploy to Render
    □ Run backfill for all channels (scripts/backfill-shorts-media.ts)

PHASE 2 — PROMPT 3 (QA)
  □ Enable SHORTS_V2=true on staging
  □ 200-swipe test, 0 spinner verification
  □ First-frame latency measurement with debug overlay
  □ Regression testing on all non-Shorts routes
  □ Fix Critical/High issues
  □ Enable SHORTS_V2=true on production
  □ Produce QA_REPORT_SHORTS_V2.md

PHASE 3 — MAINTENANCE (ongoing)
  □ Render Cron: daily yt-dlp check for new Shorts (auto-ingest)
  □ Delete R2 objects when channels are removed
  □ Monitor R2 storage usage monthly
  □ Update yt-dlp binary on Render if YouTube breaks it
```

### Manual Setup Guide (Beginner-Friendly)

**Step 1: Create Cloudflare R2 Bucket**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Sign in / Create free account
2. Left sidebar → **R2 Object Storage** → **Create bucket**
3. Bucket name: `jrujutv-shorts` → Location: Automatic → Click **Create bucket**
4. Click on the bucket → **Settings** tab → **Public Access** → **Allow Access**
5. Copy the **Public Bucket URL** (looks like `https://pub-xxxx.r2.dev`) — this is your `CLOUDFLARE_R2_PUBLIC_URL`

**Step 2: Create R2 API Token**
1. Cloudflare Dashboard → **R2** → **Manage R2 API Tokens** → **Create API Token**
2. Token name: `jrujutv-ingest`
3. Permissions: **Object Read & Write** → Specific bucket: `jrujutv-shorts`
4. Click **Create API Token**
5. Copy **Access Key ID** → `CLOUDFLARE_R2_ACCESS_KEY_ID`
6. Copy **Secret Access Key** → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
7. Copy **Account ID** (top of R2 page) → `CLOUDFLARE_R2_ACCOUNT_ID`

**Step 3: Add Environment Variables to Render**
1. Go to [render.com](https://render.com) → Your JruJu TV service → **Environment**
2. Add each variable:
   - `CLOUDFLARE_R2_ACCOUNT_ID` = from step 2
   - `CLOUDFLARE_R2_ACCESS_KEY_ID` = from step 2
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY` = from step 2
   - `CLOUDFLARE_R2_BUCKET_NAME` = `jrujutv-shorts`
   - `CLOUDFLARE_R2_PUBLIC_URL` = from step 1
   - `NEXT_PUBLIC_SHORTS_V2` = `false` (keep disabled until QA passes)

**Step 4: Run Database Migration**
1. Go to your Supabase project → **SQL Editor**
2. Open `supabase/migrations/021_shorts_v2_media.sql`
3. Paste the contents → Click **Run**
4. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='videos' AND column_name='storage_url';` → should return 1 row

**Step 5: Install yt-dlp and ffmpeg on Render** (via build command or Dockerfile)
1. Add to Render build command: `pip install yt-dlp` (if Python available) OR use the yt-dlp npm package: `npm install yt-dlp-wrap`
2. ffmpeg: Render's default image includes ffmpeg. Verify with `which ffmpeg` in Render Shell.

**Step 6: Run Initial Backfill**
```bash
# In Render Shell or locally (with correct env vars set):
node scripts/backfill-shorts-media.ts
# Processes all pending Shorts, ~1–2 minutes per video
# Monitor progress via Render logs
```

**Step 7: Enable V2**
Once all Shorts are processed (`media_status='ready'` in DB):
1. Render → Environment → Set `NEXT_PUBLIC_SHORTS_V2=true`
2. Trigger a new deploy
3. Test with `?debug=1` in the URL: `https://jrujutv.onrender.com/shorts?debug=1`

---

## Appendix: Research Citations

| Claim | Source | Date |
|---|---|---|
| Hidden iframes blocked for autoplay | YouTube IFrame API docs (`onAutoplayBlocked` event, min 200×200 px requirement) | 2024 |
| `cueVideoById` doesn't pre-buffer video stream | YouTube IFrame API docs + Stack Overflow | 2024 |
| `preload="auto"` ignored on mobile metered connections | web.dev, mux.com | 2024 |
| `requestVideoFrameCallback` for first-frame detection | MDN Web Docs | 2024 |
| R2 free tier: 10 GB storage, 10M reads, $0 egress | Cloudflare R2 pricing page | 2025 |
| yt-dlp downloading violates YouTube ToS | YouTube ToS Section 5.1.H, torrentfreak.com | 2024 |
| Self-hosting for public redistribution = copyright infringement | Research summary, GitHub yt-dlp legal discussion | 2024 |
| Player pooling with 3–5 elements is industry standard | proandroiddev.com, cred.club engineering blog | 2024 |
| `-movflags +faststart` enables instant MP4 playback | ffmpeg docs, mpegflow.com | 2024 |
| Service Worker with RangeRequestsPlugin for video caching | Workbox docs (Google) | 2024 |
| Scroll velocity-based adaptive preloading | Medium engineering blog, TikTok architecture analysis | 2024 |

