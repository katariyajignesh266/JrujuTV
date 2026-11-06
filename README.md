# JrujuTV — Premium Children's Video Platform

Curated, parent-controlled video platform designed specifically for children. Built with Next.js 15, React 19, Tailwind CSS, Supabase (Auth, Postgres, Edge Functions), and hosted on Render.

---

## ⚡ Pure-Video Shorts Engine

The Shorts experience in JruJu TV has been reconstructed from scratch to deliver an instant-loading, distraction-free vertical feed:

### Features
- **Pure Full-Screen Video**: Exactly one Short per screen using CSS scroll-snap (`snap-stop: always`, `100dvh`), with safe-area insets for modern mobile displays (iOS notches & dynamic bars).
- **Anti-Iframe Look**: Utilizes oversized rendering with proportional scale-down (`shorts-player-frame`) combined with comprehensive CSS suppression of native YouTube controls, titles, logos, watermarks, and caption containers.
- **Instant Preloading & Zero-Flicker**: Dual-player pool preloads the subsequent short before scroll arrival. Seamless poster crossfade when playback reaches `PLAYING`.
- **Autoplay & Audio Policy**: Starts muted to satisfy strict browser autoplay policies on iOS Safari and Android Chrome; a single tap on the gesture layer unlocks unmuted audio for the rest of the viewing session.
- **Lane-by-Lane Round-Robin Interleaving**: Distributes shorts equitably across all parent-approved channels (`Channel 1[1], Channel 2[1], ... Channel N[1], Channel 1[2], Channel 2[2]...`).
- **50% Seen Exclusion & Auto-Recycle**: Videos watched $\ge 50\%$ are excluded until the pool is exhausted, then recycled seamlessly.
- **Parent Controls**: Per-channel toggle (`shorts_enabled`) and per-channel limit (`shorts_limit`) accessible via Settings → Manage Channels.

---

## 🛠️ Automated Testing

Run the feed algorithm unit test suite:
```bash
npm run test:shorts
```

This verifies:
1. YouTube video ID sanitization and deduplication.
2. 10-channel strict lane-by-lane round-robin interleaving with zero consecutive same-channel videos.
3. Channel exhaustion and skipping.
4. $\ge 50\%$ watch progress exclusion.
5. Parent per-channel `shorts_limit` setting compliance.
6. Single channel edge case.
7. Zero channels / empty state handling.

---

## 📖 Manual Setup Guide (Step-by-Step)

### 1. Supabase Database Migration
To apply the database schema update that removes obsolete engagement tables and updates `get_shorts_feed`:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to your JruJu TV project -> **SQL Editor**.
3. Open `supabase/migrations/020_shorts_cleanup.sql` from this repository.
4. Paste the SQL content into the SQL Editor and click **Run**.
5. *Rollback safety*: If you ever need to restore previous engagement tables, execute `supabase/migrations/020_shorts_cleanup_rollback.sql`.

### 2. Supabase Environment Variables
Ensure the following variables are present in your project:
- In `.env.local` (local development) and Render Environment Settings:
  - `NEXT_PUBLIC_SUPABASE_URL`: Found in Supabase Dashboard -> **Project Settings** -> **API** -> Project URL.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Found in Supabase Dashboard -> **Project Settings** -> **API** -> `anon` public key.
- In Supabase Edge Functions Secrets:
  - `YOUTUBE_API_KEY`: Google Cloud Console YouTube Data API v3 key (used only server-side by channel ingestion Edge Functions).
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard -> **Project Settings** -> **API** -> `service_role` secret key.

### 3. Deploy to Render
1. Push your changes to the `main` branch on GitHub:
   ```bash
   git add .
   git commit -m "feat(shorts): reconstruct pure-video shorts experience with lane-by-lane feed and anti-iframe scaling"
   git push origin main
   ```
2. Render will automatically detect the push and trigger a build.
3. Verify build command in Render: `npm run build`.
4. Verify start command in Render: `npm run start`.

### 4. Verification Checklist on Your Mobile Device
1. Open the deployed application on an iPhone or Android phone.
2. Tap the **Shorts** tab in the bottom navigation bar.
3. Verify:
   - Fullscreen 9:16 card snaps cleanly with zero half-screens.
   - Small "⚡ Shorts" badge appears top-left.
   - No like, comment, save, or subscribe buttons appear on screen.
   - No YouTube title, channel name, or progress bar is visible (anti-iframe scaling).
   - "Tap for sound" prompt appears on first view; tapping unlocks audio for all subsequent scrolls.
   - Flicking down immediately plays the next short without delay.
