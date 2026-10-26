/**
 * Server-side Keep-Alive Self-Pinger
 *
 * Runs INSIDE the Node.js process and pings the PUBLIC Render URL
 * every ~4.5 minutes to reset Render's 15-minute inactivity timer.
 *
 * This is a SECONDARY layer — it only works while the process is already
 * running. The PRIMARY keep-alive mechanism is external pingers
 * (UptimeRobot, cron-job.org, GitHub Actions) that can WAKE a sleeping
 * instance from outside.
 *
 * Configuration (env vars):
 *   RENDER_EXTERNAL_URL – set automatically by Render (e.g. https://jrujutv.onrender.com)
 *   SELF_URL            – manual fallback if RENDER_EXTERNAL_URL isn't set
 *   KEEP_ALIVE_ENABLED  – set to "false" to disable (default: enabled in production)
 */

const INTERVAL_MS = 4.5 * 60 * 1000; // 4 min 30 sec — well within Render's 15-min window
const TIMEOUT_MS = 10_000;            // 10 second timeout per attempt
const MAX_RETRIES = 2;                // retry twice on failure
const RETRY_DELAY_MS = 2_000;         // 2 seconds between retries

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

// ─── Public URL resolution ───────────────────────────────────────────────────

function getPublicUrl(): string | null {
  const rawUrl = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Ensure protocol is present
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

// ─── Ping with structured logging + retries ──────────────────────────────────

async function pingWithRetry(url: string, attempt = 1): Promise<void> {
  if (!isRunning) return;

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (typeof timeout === 'object' && 'unref' in timeout) {
    timeout.unref();
  }

  let resOk = false;
  let status = 0;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    status = res.status;
    resOk = res.ok;
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  const latency = Date.now() - start;

  if (resOk) {
    console.log(
      `[SelfPing] status=${status} latency=${latency}ms attempt=${attempt} url=${url}`
    );
    return;
  }

  if (errorMsg) {
    console.warn(
      `[SelfPing] FAILED latency=${latency}ms attempt=${attempt} error="${errorMsg}" url=${url}`
    );
  } else {
    console.warn(
      `[SelfPing] NON-OK status=${status} latency=${latency}ms attempt=${attempt} url=${url}`
    );
  }

  // Retry up to MAX_RETRIES if still running
  if (isRunning && attempt <= MAX_RETRIES) {
    await delay(RETRY_DELAY_MS);
    if (isRunning) {
      await pingWithRetry(url, attempt + 1);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Start / Stop ────────────────────────────────────────────────────────────

export function startSelfPing(): void {
  // Guard: do not run during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  // Guard: only in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SelfPing] Skipped — not in production');
    return;
  }

  // Guard: opt-out via env
  if (process.env.KEEP_ALIVE_ENABLED === 'false') {
    console.log('[SelfPing] Skipped — KEEP_ALIVE_ENABLED=false');
    return;
  }

  // Prevent duplicate timers if already running
  if (isRunning) {
    console.log('[SelfPing] Already running — skipping duplicate start');
    return;
  }

  const baseUrl = getPublicUrl();
  if (!baseUrl) {
    console.warn(
      '[SelfPing] Skipped — neither RENDER_EXTERNAL_URL nor SELF_URL is set. ' +
        'Self-ping requires the public URL to generate external traffic.'
    );
    return;
  }

  const healthUrl = `${baseUrl.replace(/\/+$/, '')}/api/health`;

  isRunning = true;

  console.log(
    `[SelfPing] Starting — url=${healthUrl} interval=${INTERVAL_MS / 1000}s ` +
      `timeout=${TIMEOUT_MS / 1000}s retries=${MAX_RETRIES}`
  );

  // Clear any dangling timers defensively
  if (initialTimeoutId) clearTimeout(initialTimeoutId);
  if (intervalId) clearInterval(intervalId);

  // Fire the first ping after a short delay (let the server finish starting)
  initialTimeoutId = setTimeout(() => {
    initialTimeoutId = null;
    pingWithRetry(healthUrl);
  }, 5_000);
  if (initialTimeoutId && typeof initialTimeoutId === 'object' && 'unref' in initialTimeoutId) {
    initialTimeoutId.unref();
  }

  intervalId = setInterval(() => {
    pingWithRetry(healthUrl);
  }, INTERVAL_MS);

  // unref() so this timer doesn't prevent Node.js from exiting on SIGTERM
  if (intervalId && typeof intervalId === 'object' && 'unref' in intervalId) {
    intervalId.unref();
  }
}

export function stopSelfPing(): void {
  isRunning = false;

  if (initialTimeoutId) {
    clearTimeout(initialTimeoutId);
    initialTimeoutId = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[SelfPing] Stopped');
}

// ─── Graceful shutdown ───────────────────────────────────────────────────────

export function setupGracefulShutdown(): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return; // prevent double-handling
    shuttingDown = true;

    console.log(`[Shutdown] Received ${signal} — draining in-flight requests...`);
    stopSelfPing();

    // Give in-flight requests 5 seconds to complete, then force exit
    setTimeout(() => {
      console.log('[Shutdown] Grace period expired — exiting');
      process.exit(0);
    }, 5_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
