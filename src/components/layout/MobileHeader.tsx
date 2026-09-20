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
          'sticky top-0 z-50 h-12',
          'bg-surface-primary border-b border-border',
          'transition-theme',
          'flex md:hidden items-center justify-between px-3 sm:px-4 gap-2'
        )}
      >
        {/* Left: Logo */}
        <Link href="/" aria-label="JruJu TV home" className="shrink-0 flex items-center">
          <Logo size="sm" variant="full" />
        </Link>

        {/* Right cluster */}
        <div className="flex items-center gap-0.5 shrink-0">
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
