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
        'min-touch transition-theme',
        btnSizes[size],
        variant === 'ghost' && [
          'text-content-secondary hover:text-content-primary',
          'hover:bg-surface-secondary dark:hover:bg-surface-secondary',
          'focus-visible:ring-2 focus-visible:ring-brand-primary',
        ],
        variant === 'filled' && [
          'bg-brand-primary text-white',
          'hover:opacity-90 active:scale-95',
        ],
        variant === 'outline' && [
          'border border-border text-content-primary',
          'hover:bg-surface-secondary',
        ],
        'transition-all duration-150 active:scale-95',
        className
      )}
      {...props}
    >
      <span className="relative inline-flex items-center justify-center">
        <Icon size={iconSizes[size]} strokeWidth={1.75} className={iconClassName} aria-hidden="true" />
        {badge !== undefined && badge > 0 && (
          <span
            aria-label={`${badge} notifications`}
            className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-brand-primary text-white text-[10px] font-bold leading-none ring-2 ring-surface-primary group-hover:ring-surface-secondary shadow-sm shadow-brand-primary/30 pointer-events-none select-none transition-colors"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
    </button>
  );
}

