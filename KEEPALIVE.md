# Keep-Alive Setup Guide — JruJu TV on Render.com

> **Goal:** The Render web service stays awake 24/7 with no cold starts.

---

## Architecture Overview

```
 LAYER 1 — EXTERNAL PINGERS (primary, can WAKE a sleeping instance)
 ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
 │ UptimeRobot  │  │ cron-job.org │  │  GitHub Actions     │
 │ GET every 5m │  │ GET every 5m │  │  GET every 5m       │
 │ (offset :00) │  │ (offset :02) │  │  (backup, may lag)  │
 └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘
        │                 │                    │
        ▼                 ▼                    ▼
 ┌─────────────────────────────────────────────────────────┐
 │     https://jrujutv.onrender.com/api/health             │
 └─────────────────────────┬───────────────────────────────┘
                           │
 LAYER 2 — SERVER-SIDE SELF-PING (secondary, runs while already awake)
 ┌─────────────────────────┴───────────────────────────────┐
 │  src/lib/keep-alive-server.ts                           │
 │  HEAD → RENDER_EXTERNAL_URL/api/health every 4.5 min    │
 │  (uses the PUBLIC URL → counts as external traffic)     │
 └─────────────────────────┬───────────────────────────────┘
                           │
 LAYER 3 — CLIENT-SIDE PING (supplementary, only while users browse)
 ┌─────────────────────────┴───────────────────────────────┐
 │  src/components/providers/KeepAlive.tsx                  │
 │  GET /api/health every 5 min from the browser           │
 └─────────────────────────────────────────────────────────┘
```

---

## The Only 100% Guaranteed Fix

> **Upgrade to Render Starter plan ($7/month).**
>
> Starter instances never sleep. No pingers needed.
>
> **Dashboard steps:**
> 1. Go to https://dashboard.render.com
> 2. Select the **jrujutv** service
> 3. Click **Settings** (left sidebar)
> 4. Scroll to **Instance Type**
> 5. Select **Starter** ($7/month)
> 6. Click **Save Changes**
>
> Or set `plan: starter` in `render.yaml` and push.

If staying on Free, use the multi-pinger setup below.

---

## External Pinger Setup (Free Tier)

### 1. UptimeRobot (Primary) — https://uptimerobot.com

| Setting              | Value                                                 |
|----------------------|-------------------------------------------------------|
| **Account**          | Sign up free at https://uptimerobot.com               |
| **Monitor Type**     | HTTP(s)                                               |
| **Friendly Name**    | JruJu TV Health                                       |
| **URL**              | `https://jrujutv.onrender.com/api/health`             |
| **Monitoring Interval** | 5 minutes (minimum on free tier)                   |
| **HTTP Method**      | GET (or HEAD)                                         |
| **Expected Status**  | 200                                                   |
| **Timeout**          | 30 seconds                                            |
| **Keyword**          | *(optional)* `"ok"` — Type: exists                    |
| **Alert Contact**    | Your email                                            |

**Steps:**
1. Create account → Dashboard → **+ Add New Monitor**
2. Fill in the values above
3. Click **Create Monitor**
4. Verify it shows ✅ green within 5 minutes

---

### 2. cron-job.org (Secondary, offset by 2 min) — https://cron-job.org

| Setting              | Value                                                 |
|----------------------|-------------------------------------------------------|
| **Account**          | Sign up free at https://cron-job.org                  |
| **Title**            | JruJu TV Keep-Alive                                  |
| **URL**              | `https://jrujutv.onrender.com/api/health`             |
| **Schedule**         | Custom cron: `2,7,12,17,22,27,32,37,42,47,52,57 * * * *` |
| **HTTP Method**      | GET                                                   |
| **Expected Status**  | 200                                                   |
| **Timeout**          | 30 seconds                                            |
| **Notifications**    | On failure only                                       |
| **Save responses**   | On failure only (saves bandwidth)                     |

**Why offset by 2 minutes?** If UptimeRobot pings at :00, :05, :10 etc., cron-job.org pings at :02, :07, :12 etc. This means the longest gap between any two pings is ~3 minutes, well within the 15-minute sleep window.

**Steps:**
1. Create account → **Create Cronjob**
2. Fill in the values above
3. Click **Create**
4. Click **Run Now** to test
5. Check **Execution History** — should show all 200s

---

### 3. GitHub Actions (Tertiary/Backup) — already configured

The file `.github/workflows/keep-alive.yml` pings every 5 minutes via cron.

**One-time setup:**
1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click the **Variables** tab → **New repository variable**
3. Name: `RENDER_URL` — Value: `https://jrujutv.onrender.com`
4. Push the workflow file to GitHub → verify it runs under **Actions** tab

**⚠️  GitHub Actions caveats:**
- Cron can be delayed by up to 15 minutes under heavy load
- GitHub auto-disables scheduled workflows after **60 days of repo inactivity**
- To re-enable: push any commit, or go to Actions → click the workflow → **Enable workflow**

---

### 4. BetterStack / Freshping (Optional 4th layer)

For maximum redundancy, add one more independent monitor:

**BetterStack (https://betterstack.com/uptime):**
- Free tier: 10 monitors, 3-minute intervals
- URL: `https://jrujutv.onrender.com/api/health`
- Method: GET, Expected: 200

**Freshping (https://www.freshworks.com/website-monitoring/):**
- Free tier: 50 monitors, 1-minute intervals
- URL: `https://jrujutv.onrender.com/api/health`
- Method: GET, Expected: 200

---

## Health Endpoint Details

| Path            | Methods    | Auth | DB  | Response Time |
|-----------------|------------|------|-----|---------------|
| `/api/health`   | GET, HEAD  | None | None| < 10ms        |
| `/api/ping`     | GET, HEAD  | None | None| < 10ms        |
| `/health`       | GET, HEAD  | None | None| < 10ms (rewrite) |
| `/ping`         | GET, HEAD  | None | None| < 10ms (rewrite) |

**GET response:**
```json
{
  "status": "ok",
  "service": "JruJuTV",
  "timestamp": "2026-10-26T15:45:00.000Z",
  "uptime": 86400
}
```

- `uptime` = seconds since last cold start. If this resets to a small number, the server was restarted.
- All paths are excluded from Supabase auth middleware.
- `Cache-Control: no-store` prevents CDN/browser caching.

---

## Environment Variables

| Variable               | Required | Set By      | Description                              |
|------------------------|----------|-------------|------------------------------------------|
| `RENDER_EXTERNAL_URL`  | Auto     | Render      | Public URL, e.g. `https://jrujutv.onrender.com` |
| `SELF_URL`             | No       | Manual      | Fallback if not on Render                |
| `KEEP_ALIVE_ENABLED`   | No       | Manual      | Set to `"false"` to disable self-pinger  |
| `NODE_ENV`             | Auto     | Render/Next | Must be `"production"` for self-ping     |

---

## Monitoring & Alerting

1. **UptimeRobot Dashboard** — shows uptime %, response time trends, incidents
2. **cron-job.org Execution History** — shows success/failure of each ping
3. **GitHub Actions tab** — check workflow run history for failures
4. **`/api/health` uptime field** — if `uptime` resets to a low number → cold start happened
5. **Render Dashboard → Events tab** — look for "Service sleeping" / "Service waking" events
6. **Server logs** — search for `[SelfPing]` entries to verify the self-pinger is running

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Server still sleeps | No external pingers configured | Set up UptimeRobot + cron-job.org (see above) |
| `uptime` keeps resetting | Free plan 750h/mo limit reached | Upgrade to Starter ($7/mo) |
| GitHub Actions not running | Disabled after 60 days inactivity | Re-enable in Actions tab |
| Self-ping logs show errors | `RENDER_EXTERNAL_URL` not set | Verify in Render dashboard → Environment |
| Health check returns 401 | Middleware not excluding `/api/health` | Check `src/middleware.ts` matcher |
| Cold start despite pingers | Render free tier is best-effort only | Upgrade to Starter — the only guarantee |

---

## Free Tier Limits

| Resource | Limit | JruJu TV Usage |
|----------|-------|----------------|
| Render free instance hours | 750h/month (shared across workspace) | 744h (24/7) — only 6h margin |
| UptimeRobot free monitors | 50 monitors, 5min interval | 1 monitor |
| cron-job.org free cronjobs | 3 jobs, 1min minimum interval | 1 job |
| GitHub Actions free minutes | 2,000 min/month (public repo: unlimited) | ~8,640 runs × 0.1min ≈ 864 min |

> **⚠️  If you have other Free services in the same Render workspace, you will exceed the 750h cap and services will be suspended.**
