# CHANGELOG: Shorts V2 Instant Playback & Zero-Spinner Architecture

**Date:** 2026-11-06  
**Status:** PROMPT 2 Build Complete — Ready for QA & Staging Verification  
**Branch / Target:** JruJu TV (`main`)  

---

## 1. Overview & Objective
Eliminate the 1–2 second loading spinner when swiping through Shorts, achieving YouTube Shorts / TikTok-grade instant video playback (target: first frame ≤ 150ms on 4G scroll, zero visible spinners), without regressions to navigation, layout, child safety, or auth.

---

## 2. Changes Delivered

### Database & Backend Migrations
- **`supabase/migrations/021_shorts_v2_media.sql`**:
  - Added columns to `public.videos`:
    - `storage_url TEXT` (direct CDN URL to pre-transcoded faststart MP4)
    - `poster_url TEXT` (direct CDN URL to 1.0s poster frame)
    - `media_status TEXT` (`'pending' | 'processing' | 'ready' | 'error' | 'skipped'`, default `'pending'`)
    - `r2_object_key TEXT` (R2 bucket object prefix for automated lifecycle management)
    - `media_error TEXT` (error tracking for failed downloads/encodes)
    - `media_queued_at TIMESTAMPTZ` (heartbeat tracking)
  - Created performance indexes:
    - `idx_videos_media_status_is_short` on `(media_status, is_short)`
    - `idx_videos_pending_shorts` on `(id)` WHERE `is_short = true AND media_status = 'pending'`
  - Updated `public.get_shorts_feed` RPC to include `storage_url`, `poster_url`, and `media_status` in returned JSON payload.
- **`supabase/migrations/021_shorts_v2_media_rollback.sql`**:
  - Full, safe, zero-downtime rollback script restoring migration 020 schema and RPC.

### Ingestion Pipeline & Scripts
- **`scripts/ingest-shorts.mjs`**:
  - Production-ready ingestion script.
  - Downloads YouTube Shorts via `yt-dlp` capped at 1080p and 65 seconds.
  - Transcodes with `ffmpeg` using `-c:v libx264 -preset fast -crf 23 -profile:v baseline -level 3.1 -c:a aac -b:a 128k -movflags +faststart` to place the `moov` atom at the very beginning of the file for instant byte-range streaming.
  - Extracts poster image at 1.0s via `ffmpeg -ss 00:00:01.000`.
  - Zero-dependency AWS Signature V4 S3 uploader sending assets to Cloudflare R2 (`Cache-Control: public, max-age=31536000, immutable`).
  - Updates Supabase records with `media_status = 'ready'`, `storage_url`, and `poster_url`.
- **`scripts/backfill-shorts-media.mjs`**:
  - Automated batch backfill worker that processes all existing `pending` Shorts in the database.
- **`scripts/test-shorts-feed.mjs`**:
  - Added Tests 8 & 9 to verify V2 media fields delivery and routing/fallback logic. All 9 tests pass.

### Frontend Architecture
- **`src/features/shorts/types/index.ts`**:
  - Added `ShortMediaStatus`, `storage_url`, `poster_url`, and `media_status` to `ShortVideo` interface.
- **`src/features/shorts/hooks/useShortsV2PlayerPool.ts`**:
  - 3–4 player sliding pool (`[N-1, N, N+1, N+2]`).
  - Pre-buffers N+1 and N+2 natively using `<video preload="auto" muted playsinline loop>`.
  - Uses `requestVideoFrameCallback` to detect exact frame paint timing.
  - First-tap gesture audio unlock (`hasUserGestureUnlocked`) seamlessly applied to all subsequent videos.
  - Progress tracking with 50% watch record to Supabase.
  - Automatic low-memory adaptation (reduces pool size on low-end devices < 2GB RAM or 2G network).
  - Explicit teardown of out-of-range elements (`el.src = ''; el.load(); el.remove()`) ensuring zero memory leaks.
- **`src/features/shorts/components/ShortsVideoPlayer.tsx`**:
  - Native video container component mounted inside the 9:16 card.
- **`src/features/shorts/components/ShortsDebugOverlay.tsx`**:
  - Live HUD triggered via `?debug=1` showing active slot, pool status, first-frame latency (target ≤ 150ms), spinner count (target: 0), and engine mode.
- **`src/features/shorts/components/ShortsItem.tsx`**:
  - Branches cleanly between V2 Native Video (zero spinner, smooth poster crossfade) and V1 YouTube IFrame fallback based on `NEXT_PUBLIC_SHORTS_V2` and video readiness.
- **`src/features/shorts/components/ShortsContainer.tsx`**:
  - Connects both V1 and V2 pools, manages debug overlay state, passes video gesture and progress handlers.
- **`src/features/shorts/index.ts`**:
  - Updated exports to include V2 components and hooks.
- **`src/app/globals.css`**:
  - Added `.shorts-native-video` styles with hardware acceleration and WebKit media controls suppression.

---

## 3. Verification & Test Results
- **Automated Unit Tests**: `npm run test:shorts` → ✅ 9/9 PASS.
- **Production Next.js Build**: `npm run build` → ✅ Compiled successfully with 0 errors.

