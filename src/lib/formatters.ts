// src/lib/formatters.ts

/**
 * Format a numeric view count in standard YouTube abbreviated format.
 * Examples:
 *   742 -> "742 views"
 *   1 -> "1 view"
 *   4,800 -> "4.8K views"
 *   12,300 -> "12K views"
 *   452,000 -> "452K views"
 *   1,200,000 -> "1.2M views"
 *   1,250,000,000 -> "1.2B views"
 */
export function formatViewCount(views?: number | null): string {
  if (views === undefined || views === null || isNaN(views)) {
    return '';
  }
  const count = Math.max(0, Math.floor(views));
  if (count === 1) return '1 view';
  if (count < 1000) return `${count} views`;

  const compact = formatCompactNumber(count);
  return `${compact} views`;
}

/**
 * Format an abbreviated number without trailing "views" (useful for subscriber counts, card badges, etc.)
 * Examples: 1420 -> "1.4K", 450000 -> "450K", 1200000 -> "1.2M"
 */
export function formatCompactNumber(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  const n = Math.max(0, num);
  if (n < 1000) return n.toString();

  if (n < 1_000_000) {
    // Under 10k show 1 decimal (e.g. 4.8K), 10k+ show whole number (e.g. 12K, 452K)
    const val = n / 1000;
    const formatted = val < 10 ? val.toFixed(1) : Math.floor(val).toString();
    return `${formatted.replace(/\.0$/, '')}K`;
  }

  if (n < 1_000_000_000) {
    // Under 10M show 1 decimal (e.g. 1.2M), 10M+ show whole number (e.g. 14M)
    const val = n / 1_000_000;
    const formatted = val < 10 ? val.toFixed(1) : Math.floor(val).toString();
    return `${formatted.replace(/\.0$/, '')}M`;
  }

  const val = n / 1_000_000_000;
  return `${val.toFixed(1).replace(/\.0$/, '')}B`;
}

/**
 * Format an ISO date string or Date into standard YouTube-style relative time phrases.
 * Examples: "Just now", "42 minutes ago", "3 hours ago", "3 days ago", "2 weeks ago", "4 months ago", "2 years ago"
 */
export function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return 'Just now';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInDays < 30) {
    return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
}

/**
 * Format watch-time seconds for dashboard display.
 * Examples:
 *   0   -> "0m"
 *   45  -> "<1m"
 *   90  -> "1m"
 *   3600 -> "1h 0m"
 *   5400 -> "1h 30m"
 */
export function formatWatchDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '0m';
  const s = Math.floor(totalSeconds);
  if (s < 60) return s > 0 ? '<1m' : '0m';
  const minutes = Math.floor(s / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  return `${minutes}m`;
}

/**
 * Format seconds to a compact hours display (e.g. "2.4h") for bar charts.
 */
export function formatHours(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0h';
  const hours = totalSeconds / 3600;
  if (hours < 0.1) return '<0.1h';
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

/**
 * Format video duration in seconds to standard MM:SS or HH:MM:SS format.
 * Examples:
 *   65 -> "1:05"
 *   315 -> "5:15"
 *   3665 -> "1:01:05"
 */
export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return '';
  }
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const remainingSeconds = s % 60;

  const paddedSeconds = String(remainingSeconds).padStart(2, '0');

  if (hours > 0) {
    const paddedMinutes = String(minutes).padStart(2, '0');
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}
