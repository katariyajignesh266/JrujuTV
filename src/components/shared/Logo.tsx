'use client';

import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  className?: string;
}

const sizes = {
  sm: { icon: 28, text: 'text-base' },
  md: { icon: 36, text: 'text-lg' },
  lg: { icon: 48, text: 'text-2xl' },
};

export function Logo({ size = 'md', variant = 'full', className }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={cn('flex items-center gap-2 select-none', className)} aria-label="JruJu TV">
      {/* Brand mark SVG */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Background circle */}
        <rect width="40" height="40" rx="10" fill="var(--color-brand-primary)" />
        {/* Play triangle */}
        <polygon points="14,10 32,20 14,30" fill="white" opacity="0.95" />
        {/* Brand dot */}
        <circle cx="11" cy="30" r="4" fill="var(--color-brand-secondary)" />
      </svg>

      {variant === 'full' && (
        <span
          className={cn(
            'font-display font-bold tracking-tight leading-none',
            s.text,
            'text-content-primary'
          )}
        >
          <span style={{ color: 'var(--color-brand-primary)' }}>Jru</span>
          <span style={{ color: 'var(--color-brand-secondary)' }}>Ju</span>
          <span className="text-content-primary"> TV</span>
        </span>
      )}
    </div>
  );
}

