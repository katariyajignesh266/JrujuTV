'use client';

import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function PageShell({ children, className, fullWidth }: PageShellProps) {
  const { sidebarOpen } = useUIStore();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        'transition-all duration-300 ease-in-out',
        // Mobile (<768px): add bottom padding for the tab bar + safe area
        'pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-6',
        // Tablet & Desktop (>=768px): offset by collapsed sidebar width (72px)
        'md:ml-[72px]',
        // Desktop (>=1280px): push content smoothly when sidebar is expanded
        sidebarOpen && 'xl:ml-60',
        // Inner padding
        'px-3 sm:px-4 md:px-6 pt-4 md:pt-6',
        !fullWidth && 'max-w-screen-2xl mx-auto',
        className
      )}
    >
      {children}
    </main>
  );
}
