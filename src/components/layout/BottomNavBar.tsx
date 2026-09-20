'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { MOBILE_BOTTOM_NAV } from '@/constants/nav';
import { cn } from '@/lib/cn';
import { CircleUser } from 'lucide-react';

export function BottomNavBar() {
  const pathname = usePathname();
  const { openAuthModal } = useUIStore();
  const { role, user } = useAuthStore();

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'md:hidden', // Visible only on mobile (<768px), strictly hidden on tablet and desktop
        'fixed bottom-0 inset-x-0 z-50',
        'bg-surface-primary border-t border-border',
        'transition-theme',
        // Safe area for iOS home indicator
        'pb-[env(safe-area-inset-bottom)]'
      )}
    >
      <ul
        role="list"
        className="flex h-14 items-stretch justify-around px-1"
      >
        {MOBILE_BOTTOM_NAV.map((item) => {
          const isProfile = item.id === 'profile';
          const isActive = isProfile
            ? pathname.startsWith('/profile') || pathname.startsWith('/auth')
            : item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          const handleClick = () => {
            if (isProfile && role === 'guest') {
              openAuthModal();
              return;
            }
          };

          const isAuthUser = isProfile && role !== 'guest';

          return (
            <li key={item.id} className="flex-1 min-w-0 flex items-center justify-center">
              <Link
                href={isProfile && role === 'guest' ? '#' : item.href}
                onClick={handleClick}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5',
                  'w-full h-full min-h-[44px] px-1',
                  'transition-colors duration-150',
                  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
                  isActive ? 'text-brand-primary' : 'text-content-secondary hover:text-content-primary'
                )}
              >
                <div className="relative flex items-center justify-center">
                  {isAuthUser ? (
                    <div
                      className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold',
                        isActive && 'ring-2 ring-brand-primary ring-offset-1'
                      )}
                      style={{
                        background: role === 'parent' ? 'var(--color-brand-primary)' : 'var(--color-brand-tertiary)',
                      }}
                      aria-hidden="true"
                    >
                      {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                    </div>
                  ) : (
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden="true"
                      className={cn('shrink-0', isActive && 'fill-brand-primary/15')}
                    />
                  )}

                  {/* Active dot indicator */}
                  {isActive && (
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-primary"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <span
                  className={cn(
                    'text-[10px] leading-none tracking-tight truncate max-w-full text-center',
                    isActive ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {isAuthUser ? 'You' : item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
