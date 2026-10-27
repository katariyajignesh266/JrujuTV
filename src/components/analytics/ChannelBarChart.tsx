'use client';

import { formatHours } from '@/lib/formatters';

interface ChannelBar {
  channel_id: string;
  channel_name: string;
  channel_thumbnail?: string;
  total_seconds: number;
}

interface ChannelBarChartProps {
  bars: ChannelBar[];
  className?: string;
}

export function ChannelBarChart({ bars, className = '' }: ChannelBarChartProps) {
  if (!bars || bars.length === 0) return null;

  const maxSeconds = Math.max(...bars.map((b) => b.total_seconds), 1);

  return (
    <div className={`space-y-3 ${className}`} role="list" aria-label="Watch time by channel">
      {bars.map((bar, i) => {
        const pct = Math.max(4, (bar.total_seconds / maxSeconds) * 100);
        return (
          <div key={bar.channel_id} className="flex items-center gap-3" role="listitem">
            {/* Channel avatar */}
            <div className="h-7 w-7 rounded-full overflow-hidden bg-surface-secondary border border-border shrink-0">
              {bar.channel_thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bar.channel_thumbnail}
                  alt={bar.channel_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-brand-primary">
                  {bar.channel_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Bar + label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-content-primary truncate pr-2 max-w-[65%]">
                  {bar.channel_name}
                </span>
                <span className="text-[11px] font-semibold text-content-secondary shrink-0">
                  {formatHours(bar.total_seconds)}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `hsl(${4 + i * 30}, 80%, ${50 - i * 3}%)`,
                    opacity: 0.85,
                  }}
                  role="progressbar"
                  aria-valuenow={bar.total_seconds}
                  aria-valuemin={0}
                  aria-valuemax={maxSeconds}
                  aria-label={`${bar.channel_name}: ${formatHours(bar.total_seconds)}`}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
