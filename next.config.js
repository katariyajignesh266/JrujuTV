/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  // ── PWA: service worker headers ────────────────────────────────────────────
  // sw.js must NOT be cached aggressively — the browser needs to check for
  // a new version on every navigation to trigger SW updates.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            // no-cache: revalidate on every request (not "no-store" — allows ETag)
            value: 'public, no-cache',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        // Manifest: short cache, revalidated — ensures icon/name changes propagate
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
  // ── Keep-alive: top-level aliases for /api/health ──────────────────────────
  // Render healthCheckPath and external monitors can use /health or /ping
  // instead of the longer /api/health path.
  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/ping', destination: '/api/health' },
    ];
  },
};

module.exports = nextConfig;

