'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { IconButton } from '@/components/shared/IconButton';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { useUIStore } from '@/store/uiStore';
import { MobileSearchOverlay } from '@/components/shared/SearchBar';
import { cn } from '@/lib/cn';

export function MobileHeader() {
  const { toggleSearch } = useUIStore();

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 h-[52px]',
          /* Glass surface */
          'bg-white/80 dark:bg-[#080810]/85 backdrop-blur-2xl',
          /* Subtle border */
          'border-b border-neutral-200/60 dark:border-white/[0.06]',
          /* Premium shadow */
          'shadow-[0_1px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_24px_rgba(0,0,0,0.40)]',
          'transition-theme',
          'flex md:hidden items-center justify-between px-3 sm:px-4 gap-2'
        )}
      >
        {/* Subtle top shimmer accent */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent pointer-events-none" />

        {/* Left: Logo */}
        <Link
          href="/"
          aria-label="JruJu TV home"
          className="shrink-0 flex items-center transition-transform duration-200 active:scale-95"
        >
          <Logo size="sm" variant="full" />
        </Link>

        {/* Right cluster */}
        <div className="flex items-center gap-0 shrink-0">
          <IconButton
            icon={Search}
            label="Open search"
            onClick={toggleSearch}
          />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      {/* Full-screen search overlay */}
      <MobileSearchOverlay />
    </>
  );
}
