/**
 * GET/HEAD /health — top-level health check endpoint
 *
 * Direct route (in addition to rewrites) to guarantee zero-latency
 * response for Render's healthCheckPath and external uptime pingers.
 */
export { GET, HEAD, OPTIONS } from '@/app/api/health/route';
