/**
 * Next.js Instrumentation
 *
 * Called once when the Next.js server starts (both dev and production).
 * Used to initialize the server-side keep-alive self-pinger and
 * graceful shutdown handler.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server runtime (not in Edge or during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSelfPing, setupGracefulShutdown } = await import(
      '@/lib/keep-alive-server'
    );

    // Set up SIGTERM/SIGINT handlers for graceful shutdown on Render deploys
    setupGracefulShutdown();

    // Start the server-side self-pinger (only activates in production)
    startSelfPing();
  }
}
