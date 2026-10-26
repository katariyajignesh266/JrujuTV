/**
 * GET/HEAD /api/ping — alias for /api/health
 *
 * Convenience alias so external monitors can use either URL.
 * Re-exports the same zero-dependency handlers from the health route.
 */
export { GET, HEAD, OPTIONS } from '@/app/api/health/route';
