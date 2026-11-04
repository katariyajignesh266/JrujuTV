'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';
import { MainScrollContext } from './MainScrollContext';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function PageShell({ children, className, fullWidth }: PageShellProps) {
  const { sidebarOpen } = useUIStore();
  const mainRef = useRef<HTMLElement>(null);

  return (
    <MainScrollContext.Provider value={mainRef}>
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={cn(
          'transition-all duration-300 ease-in-out',
          // Mobile (<768px): add bottom padding for the tab bar + safe area, normal natural scroll
          'pb-[calc(56px+env(safe-area-inset-bottom))] w-full max-w-full overflow-x-hidden',
          // Tablet & Desktop (>=768px): independent contained scroll shell below fixed 56px header
          'md:fixed md:top-14 md:bottom-0 md:right-0 md:overflow-y-auto md:overscroll-y-contain md:pb-8',
          '[scrollbar-gutter:stable]',
          // Desktop sidebar offset
          'md:left-[72px]',
          sidebarOpen ? 'xl:left-60' : 'xl:left-[72px]',
          // Inner padding
          'px-3 sm:px-4 md:px-6 pt-4 md:pt-6',
          className
        )}
      >
        <div className={cn('w-full', !fullWidth && 'max-w-[1680px] mx-auto')}>
          {children}
        </div>
      </main>
    </MainScrollContext.Provider>
  );
}
