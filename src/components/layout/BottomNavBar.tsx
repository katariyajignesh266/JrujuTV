'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { MOBILE_BOTTOM_NAV } from '@/constants/nav';
import { cn } from '@/lib/cn';

export function BottomNavBar() {
  const pathname = usePathname();
  const isShorts = pathname === '/shorts';
  const { openAuthModal } = useUIStore();
  const { role, user } = useAuthStore();

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 w-full overflow-hidden pb-[env(safe-area-inset-bottom)] md:hidden',
        isShorts
          ? 'bg-[#101012] pl-[max(4px,env(safe-area-inset-left))] pr-[max(4px,env(safe-area-inset-right))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
          : 'border-t border-neutral-200/80 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-2xl transition-colors duration-200 dark:border-white/[0.08] dark:bg-[#090910]/95 dark:shadow-[0_-4px_30px_rgba(0,0,0,0.6)]'
      )}
    >
      {!isShorts && (
        <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-red-500/25 to-transparent pointer-events-none" />
      )}

      <ul
        role="list"
        className={cn('grid w-full grid-cols-5 items-stretch', isShorts ? 'h-[var(--bottom-nav-h)]' : 'h-[58px]')}
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
                  'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                  isShorts
                    ? 'rounded-xl text-[#bcbcc3] hover:text-white focus-visible:ring-[#ffbd59] aria-[current=page]:text-[#ffbd59]'
                    : cn('focus-visible:ring-red-500 active:scale-90', isActive
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200')
                )}
              >
                <div className={cn('relative flex items-center justify-center', isShorts && 'h-7 w-11 rounded-full', isShorts && isActive && 'bg-[#ffbd59] text-[#20150b]')}>
                  {isActive && !isShorts && (
                    <div className="absolute inset-[-6px] rounded-xl bg-red-500/10 dark:bg-red-500/15 animate-nav-pop" />
                  )}

                  {isAuthUser ? (
                    <div
                      className={cn(
                        'relative h-6 w-6 rounded-full flex items-center justify-center text-white text-[10.5px] font-bold z-10',
                        'shadow-md',
                        isActive && 'ring-2 ring-red-500 ring-offset-1 dark:ring-offset-[#090910]'
                      )}
                      style={{
                        background: isShorts
                          ? '#4a3c30'
                          : role === 'parent'
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
                      strokeWidth={isActive ? 2.25 : 1.7}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 relative z-10 transition-transform duration-200',
                        isActive && !isShorts && 'scale-[1.08]'
                      )}
                    />
                  )}
                </div>

                <span
                  className={cn(
                    'leading-none truncate max-w-full text-center mt-0.5',
                    isShorts ? 'text-xs' : 'text-[10px] tracking-tight',
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
