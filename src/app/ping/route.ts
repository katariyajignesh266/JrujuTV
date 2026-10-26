/**
 * GET/HEAD /ping — top-level ping endpoint
 *
 * Direct route (in addition to rewrites) to guarantee zero-latency
 * response for pingers.
 */
export { GET, HEAD, OPTIONS } from '@/app/api/health/route';
