'use client';

import { cn } from '@/lib/cn';
import { type LucideIcon } from 'lucide-react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'filled' | 'outline';
  badge?: number;
  iconClassName?: string;
}

const iconSizes = { sm: 16, md: 20, lg: 22 };
const btnSizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
};

export function IconButton({
  icon: Icon,
  label,
  size = 'md',
  variant = 'ghost',
  badge,
  className,
  iconClassName,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'group relative inline-flex items-center justify-center rounded-full',
        'min-touch transition-all duration-200',
        btnSizes[size],
        variant === 'ghost' && [
          'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          'hover:bg-neutral-100/80 dark:hover:bg-white/[0.07]',
          'focus-visible:ring-2 focus-visible:ring-red-500/50',
        ],
        variant === 'filled' && [
          'bg-gradient-to-br from-red-500 to-rose-600 text-white',
          'shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/35',
          'hover:opacity-95 active:scale-95',
        ],
        variant === 'outline' && [
          'border border-[var(--color-border)] text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-bg-secondary)]',
        ],
        'active:scale-90',
        className
      )}
      {...props}
    >
      <span className="relative inline-flex items-center justify-center">
        <Icon size={iconSizes[size]} strokeWidth={1.75} className={iconClassName} aria-hidden="true" />
        {badge !== undefined && badge > 0 && (
          <span
            aria-label={`${badge} notifications`}
            className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white text-[9.5px] font-bold leading-none ring-2 ring-[var(--color-bg-primary)] shadow-sm shadow-red-500/30 pointer-events-none select-none transition-colors"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
    </button>
  );
}
