'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { IconButton } from '@/components/shared/IconButton';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { ProfileMenu } from '@/components/shared/ProfileMenu';
import { SearchBar } from '@/components/shared/SearchBar';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';

export function DesktopHeader() {
  const { toggleSidebar, sidebarOpen } = useUIStore();

  return (
    <header
      className={cn(
        'sticky top-0 z-50 h-14',
        'bg-surface-primary/80 backdrop-blur-xl',
        'border-b border-white/10 dark:border-white/5',
        'shadow-[0_1px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_24px_rgba(0,0,0,0.25)]',
        'transition-theme',
        'hidden md:flex items-center gap-3 pl-3 pr-4' // Visible on tablet (768px) and desktop
      )}
    >
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <IconButton
          icon={Menu}
          label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={toggleSidebar}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-drawer"
        />
        <Link href="/" aria-label="JruJu TV home" className="flex items-center">
          <Logo size="sm" variant="full" />
        </Link>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center px-2 md:px-4 min-w-0">
        <SearchBar />
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 shrink-0">
        <NotificationBell />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
