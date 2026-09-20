'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-4 sm:px-6 py-12 sm:py-16 text-center max-w-full',
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Icon container with decorative rings */}
      <div className="relative mb-2 shrink-0">
        <div
          className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ background: 'var(--color-bg-secondary)' }}
          aria-hidden="true"
        >
          <Icon size={32} strokeWidth={1.25} className="text-content-disabled" />
        </div>
        {/* Decorative rings - pointer-events-none to prevent touch blocking */}
        <div className="absolute -inset-2 rounded-3xl border border-border/40 -z-10 pointer-events-none" aria-hidden="true" />
        <div className="absolute -inset-4 rounded-3xl border border-border/20 -z-10 pointer-events-none" aria-hidden="true" />
      </div>

      <div className="max-w-sm space-y-2 px-2">
        <h2 className="font-display text-fluid-lg font-bold text-content-primary tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-fluid-sm text-content-secondary leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full',
            'bg-brand-primary text-white font-semibold text-fluid-sm',
            'hover:opacity-90 active:scale-95 transition-all duration-150',
            'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
