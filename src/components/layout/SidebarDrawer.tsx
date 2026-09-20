'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { MAIN_NAV, SIDEBAR_BOTTOM_NAV } from '@/constants/nav';
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
          'hidden md:flex flex-col',
          'fixed left-0 z-40 h-[calc(100dvh-56px)] top-14',
          'bg-surface-elevated/90 backdrop-blur-xl',
          'border-r border-neutral-900/10 dark:border-white/10',
          'transition-all duration-300 ease-in-out',
          'overflow-hidden shadow-sm',
          sidebarOpen ? 'w-60' : 'w-[72px]'
        )}
      >
        {/* ── Main nav (scrollable) ──────────────────────── */}
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden py-3"
          aria-label="Primary navigation"
        >
          <ul
            role="list"
            className={cn(
              'space-y-1 transition-all duration-300',
              sidebarOpen ? 'px-3' : 'px-0 flex flex-col items-center'
            )}
          >
            {MAIN_NAV.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

              return (
                <li key={item.id} className={cn(!sidebarOpen && 'w-full flex justify-center')}>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={!sidebarOpen ? item.label : undefined}
                    className={cn(
                      'flex items-center rounded-xl transition-all duration-200 group',
                      'focus-visible:ring-2 focus-visible:ring-brand-primary',
                      sidebarOpen
                        ? 'w-full px-3.5 py-2.5 gap-3 justify-start min-h-[44px]'
                        : 'w-11 h-11 justify-center',
                      isActive
                        ? 'bg-brand-primary/15 text-brand-primary font-semibold'
                        : 'text-content-secondary hover:bg-neutral-900/5 dark:hover:bg-white/5 hover:text-content-primary'
                    )}
                  >
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 transition-transform duration-150 group-hover:scale-105',
                        isActive && 'fill-brand-primary/15'
                      )}
                    />
                    {sidebarOpen && (
                      <span className="text-fluid-sm font-medium whitespace-nowrap overflow-hidden">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Bottom-pinned section ── */}
        <div
          className={cn(
            'border-t border-neutral-900/10 dark:border-white/10 py-3 space-y-1 shrink-0',
            sidebarOpen ? 'px-3' : 'px-0 flex flex-col items-center'
          )}
        >
          {SIDEBAR_BOTTOM_NAV.map((item) => {
            const isLogout = item.id === 'logout';
            const shouldShow = isLogout ? role !== 'guest' : true;
            if (!shouldShow) return null;

            const isActive = !isLogout && pathname.startsWith(item.href);

            return (
              <div key={item.id} className={cn(!sidebarOpen && 'w-full flex justify-center')}>
                <Link
                  href={isLogout ? '#' : item.href}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={!sidebarOpen ? item.label : undefined}
                  onClick={isLogout ? () => logout() : undefined}
                  className={cn(
                    'flex items-center rounded-xl transition-all duration-200 group',
                    'focus-visible:ring-2 focus-visible:ring-brand-primary',
                    sidebarOpen
                      ? 'w-full px-3.5 py-2.5 gap-3 justify-start min-h-[44px]'
                      : 'w-11 h-11 justify-center',
                    isActive && 'bg-brand-primary/15 text-brand-primary font-semibold',
                    isLogout
                      ? 'text-red-500 hover:bg-red-500/10'
                      : !isActive && 'text-content-secondary hover:bg-neutral-900/5 dark:hover:bg-white/5 hover:text-content-primary'
                  )}
                >
                  <item.icon
                    size={22}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 transition-transform duration-150 group-hover:scale-105',
                      isActive && 'fill-brand-primary/15'
                    )}
                  />
                  {sidebarOpen && (
                    <span className="text-fluid-sm font-medium whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
