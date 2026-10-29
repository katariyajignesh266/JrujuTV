'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { MOBILE_BOTTOM_NAV } from '@/constants/nav';
import { cn } from '@/lib/cn';

export function BottomNavBar() {
  const pathname = usePathname();
  const { openAuthModal } = useUIStore();
  const { role, user } = useAuthStore();

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'md:hidden', // Visible only on mobile (<768px), strictly hidden on tablet and desktop
        'fixed bottom-0 left-0 right-0 z-50 w-full max-w-full overflow-hidden',
        /* Premium glass base */
        'bg-white/80 dark:bg-[#080810]/88 backdrop-blur-2xl',
        /* Top border + shimmer */
        'border-t border-neutral-200/70 dark:border-white/[0.06]',
        /* Rich multi-layer shadow upward */
        'shadow-[0_-4px_32px_rgba(0,0,0,0.08),0_-1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_40px_rgba(0,0,0,0.55),0_-1px_0_rgba(255,255,255,0.03)]',
        'transition-theme',
        // Safe area for iOS home indicator
        'pb-[env(safe-area-inset-bottom)]'
      )}
    >
      {/* Top accent shimmer line */}
      <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-red-500/25 to-transparent pointer-events-none" />

      <ul
        role="list"
        className="grid grid-cols-5 h-[58px] w-full max-w-full items-stretch"
      >
        {MOBILE_BOTTOM_NAV.map((item) => {
          const isProfile = item.id === 'profile';
          const isActive = isProfile
            ? pathname.startsWith('/profile') || pathname.startsWith('/auth')
            : item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          const handleClick = (e: React.MouseEvent) => {
            if (isProfile && role === 'guest') {
              e.preventDefault();
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
                  'transition-all duration-200',
                  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500',
                  'active:scale-90',
                  isActive
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                )}
              >
                <div className="relative flex items-center justify-center">
                  {/* Active pill behind icon */}
                  {isActive && (
                    <div className="absolute inset-[-6px] rounded-xl bg-red-500/10 dark:bg-red-500/15 animate-nav-pop" />
                  )}

                  {isAuthUser ? (
                    <div
                      className={cn(
                        'relative h-6 w-6 rounded-full flex items-center justify-center text-white text-[10.5px] font-bold z-10',
                        'shadow-md',
                        isActive && 'ring-2 ring-red-500 ring-offset-1 dark:ring-offset-[#080810]'
                      )}
                      style={{
                        background: role === 'parent'
                          ? 'linear-gradient(135deg, #E53935, #FF8F00)'
                          : 'linear-gradient(135deg, #7C4DFF, #E53935)',
                      }}
                      aria-hidden="true"
                    >
                      {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                    </div>
                  ) : (
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.25 : 1.6}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 relative z-10 transition-transform duration-200',
                        isActive && 'scale-[1.08]'
                      )}
                    />
                  )}

                  {/* Active dot indicator */}
                  {isActive && (
                    <span
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-[3px] w-4 rounded-full bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_6px_rgba(229,57,53,0.6)]"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <span
                  className={cn(
                    'text-[10px] leading-none tracking-tight truncate max-w-full text-center mt-0.5',
                    isActive ? 'font-bold' : 'font-medium'
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
