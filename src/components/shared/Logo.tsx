'use client';

import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  className?: string;
}

const sizes = {
  sm: { icon: 30, text: 'text-[15px]' },
  md: { icon: 36, text: 'text-lg' },
  lg: { icon: 48, text: 'text-2xl' },
};

export function Logo({ size = 'md', variant = 'full', className }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={cn('flex items-center gap-2 select-none', className)} aria-label="JruJu TV">
      {/* Brand mark SVG — premium rounded rect with gradient */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_2px_6px_rgba(229,57,53,0.45)]"
      >
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E53935" />
            <stop offset="100%" stopColor="#C62828" />
          </linearGradient>
          <linearGradient id="logo-dot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFD740" />
            <stop offset="100%" stopColor="#FF8F00" />
          </linearGradient>
        </defs>
        {/* Background rounded rect */}
        <rect width="40" height="40" rx="11" fill="url(#logo-bg)" />
        {/* Inner highlight for depth */}
        <rect x="0" y="0" width="40" height="20" rx="11" fill="rgba(255,255,255,0.08)" />
        {/* Play triangle */}
        <polygon points="14,10 32,20 14,30" fill="white" opacity="0.96" />
        {/* Brand dot — golden */}
        <circle cx="11" cy="30" r="4" fill="url(#logo-dot)" />
      </svg>

      {variant === 'full' && (
        <span
          className={cn(
            'font-display font-bold tracking-tight leading-none',
            s.text,
          )}
        >
          <span className="text-red-500">Jru</span>
          <span className="text-amber-500">Ju</span>
          <span className="text-[var(--color-text-primary)]"> TV</span>
        </span>
      )}
    </div>
  );
}
