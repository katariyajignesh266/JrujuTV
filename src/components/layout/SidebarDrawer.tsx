'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { MAIN_NAV, SIDEBAR_BOTTOM_NAV } from '@/constants/nav';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/cn';
import { useRef, useEffect } from 'react';

export function SidebarDrawer() {
  const pathname = usePathname();
  const { sidebarOpen, closeSidebar } = useUIStore();
  const { role, logout } = useAuthStore();
  const sidebarRef = useRef<HTMLElement>(null);

  // Close sidebar when route changes only on overlay viewports (<1280px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280 && sidebarOpen) {
      closeSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Scrim: overlay mode on tablets and compact desktops (<1280px) */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] xl:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      <aside
        id="sidebar-drawer"
        ref={sidebarRef}
        aria-label="Site navigation"
        className={cn(
          'hidden md:flex flex-col', // Active for tablet (>=768px) and desktop
          'fixed left-0 z-40 h-[calc(100dvh-56px)] top-14',
          'bg-surface-elevated border-r border-border',
          'transition-all duration-300 ease-in-out',
          'overflow-hidden shadow-sm',
          sidebarOpen ? 'w-60' : 'w-[72px]'
        )}
      >
        {/* Top Branding / Logo */}
        <div className="h-12 px-3 flex items-center border-b border-border/40 shrink-0">
          <Link href="/" aria-label="JruJu TV Home" className="flex items-center">
            <Logo size="sm" variant={sidebarOpen ? 'full' : 'icon'} />
          </Link>
        </div>

        {/* ── Main nav (scrollable) ──────────────────────── */}
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden py-2"
          aria-label="Primary navigation"
        >
          <ul role="list" className="space-y-0.5 px-2">
            {MAIN_NAV.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={!sidebarOpen ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl',
                      'px-3 py-2.5 min-h-[44px]',
                      'transition-all duration-150',
                      'focus-visible:ring-2 focus-visible:ring-brand-primary',
                      isActive
                        ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                        : 'text-content-secondary hover:bg-surface-secondary hover:text-content-primary'
                    )}
                  >
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden="true"
                      className={cn('shrink-0', isActive && 'fill-brand-primary/15')}
                    />
                    <span
                      className={cn(
                        'text-fluid-sm font-medium whitespace-nowrap overflow-hidden',
                        'transition-all duration-300',
                        sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Bottom-pinned section (pinned, shrink-0, never clipped) ── */}
        <div className="border-t border-border py-2 px-2 space-y-0.5 shrink-0 bg-surface-elevated">
          {SIDEBAR_BOTTOM_NAV.map((item) => {
            const isLogout = item.id === 'logout';
            const shouldShow = isLogout ? role !== 'guest' : true;
            if (!shouldShow) return null;

            const isActive = !isLogout && pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={isLogout ? '#' : item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                title={!sidebarOpen ? item.label : undefined}
                onClick={isLogout ? () => logout() : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl',
                  'px-3 py-2.5 min-h-[44px]',
                  'transition-all duration-150',
                  'focus-visible:ring-2 focus-visible:ring-brand-primary',
                  isActive && 'bg-brand-primary/10 text-brand-primary font-semibold',
                  isLogout
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                    : !isActive && 'text-content-secondary hover:bg-surface-secondary hover:text-content-primary'
                )}
              >
                <item.icon
                  size={22}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden="true"
                  className={cn('shrink-0', isActive && 'fill-brand-primary/15')}
                />
                <span
                  className={cn(
                    'text-fluid-sm font-medium whitespace-nowrap overflow-hidden',
                    'transition-all duration-300',
                    sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
