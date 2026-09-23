'use client';

import { Bell, X, Settings, Sparkles, CheckCheck, Download, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { IconButton } from './IconButton';
import { useUIStore } from '@/store/uiStore';
import { usePWAStore } from '@/store/pwaStore';
import { cn } from '@/lib/cn';
import { useClickOutside } from '@/hooks/useClickOutside';

export function NotificationBell() {
  const router = useRouter();
  const { notifOpen, toggleNotif, closeNotif } = useUIStore();
  const { isInstalled, isInstallable, triggerInstall } = usePWAStore();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [mounted, setMounted] = useState(false);
  const [installing, setInstalling] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useClickOutside(panelRef, closeNotif, notifOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard dismissibility (Escape key)
  useEffect(() => {
    if (!notifOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeNotif();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [notifOpen, closeNotif]);

  // Persistent install notification when app is NOT installed
  const hasInstallNotification = mounted && !isInstalled;
  const newCount = hasInstallNotification ? 1 : 0;

  // Navigate directly to download-app page
  const handleOpenDownloadPage = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    router.push('/download-app');
    closeNotif();
  }, [router, closeNotif]);

  // Direct Install action: triggers native prompt if available, or navigates to download page
  const handleDirectInstall = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (installing) return;

    if (isInstallable && triggerInstall) {
      setInstalling(true);
      try {
        const outcome = await triggerInstall();
        if (outcome === 'accepted') {
          closeNotif();
          return;
        }
        router.push('/download-app');
        closeNotif();
      } catch (err) {
        console.error('[PWA] Install prompt error:', err);
        router.push('/download-app');
        closeNotif();
      } finally {
        setInstalling(false);
      }
      return;
    }

    router.push('/download-app');
    closeNotif();
  }, [isInstallable, triggerInstall, installing, router, closeNotif]);

  return (
    <div className="relative" ref={panelRef}>
      <IconButton
        icon={Bell}
        label="Notifications"
        badge={hasInstallNotification ? 1 : undefined}
        onClick={toggleNotif}
        aria-expanded={notifOpen}
        aria-haspopup="dialog"
      />

      {notifOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 sm:hidden animate-in fade-in duration-200"
            onClick={closeNotif}
            aria-hidden="true"
          />

          {/* Notification popup panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'fixed inset-x-3 top-14 z-50 mx-auto max-w-sm',
              'sm:absolute sm:inset-x-auto sm:-right-16 md:-right-20 lg:-right-16 sm:top-full sm:mt-2.5 sm:w-[410px] sm:max-w-none sm:mx-0',
              'rounded-2xl bg-surface-elevated/95 backdrop-blur-xl border border-border/80 shadow-2xl',
              'ring-1 ring-black/5 dark:ring-white/10',
              'max-h-[min(80dvh,540px)] overflow-hidden flex flex-col',
              'animate-in fade-in-0 zoom-in-95 duration-200 ease-out origin-top-right'
            )}
            role="dialog"
            aria-label="Notifications panel"
          >
            {/* Top Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-fluid-base text-content-primary tracking-tight">
                  Notifications
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors',
                    hasInstallNotification
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                  )}
                >
                  {newCount} new
                </span>
              </div>

              {/* Action shortcuts */}
              <div className="flex items-center gap-1">
                <Link
                  href="/settings"
                  onClick={closeNotif}
                  title="Notification settings"
                  className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-secondary transition-colors"
                >
                  <Settings size={16} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={closeNotif}
                  className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-secondary transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Filter Tabs (All / Unread) */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 shrink-0 bg-surface-primary/40">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
                  activeTab === 'all'
                    ? 'bg-content-primary text-surface-primary font-semibold shadow-sm'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary hover:bg-surface-secondary/80'
                )}
              >
                All {hasInstallNotification && <span className="ml-1 opacity-80">(1)</span>}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
                  activeTab === 'unread'
                    ? 'bg-content-primary text-surface-primary font-semibold shadow-sm'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary hover:bg-surface-secondary/80'
                )}
              >
                Unread {hasInstallNotification && <span className="ml-1 opacity-80">(1)</span>}
              </button>
            </div>

            {/* Scrollable Body */}
            {hasInstallNotification ? (
              <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleOpenDownloadPage}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleOpenDownloadPage(e);
                    }
                  }}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'group relative flex items-start gap-3.5 p-3.5 rounded-2xl text-left select-none',
                    'bg-surface-secondary/70 hover:bg-surface-secondary',
                    'active:bg-surface-secondary active:scale-[0.985] active:opacity-80',
                    'border border-border/70 hover:border-brand-primary/40',
                    'transition-all duration-150 shadow-sm hover:shadow-md cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2'
                  )}
                  aria-label="Install JruJu TV App notification - tap to open download page"
                >
                  {/* Icon with glowing brand container */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="h-11 w-11 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-md shadow-brand-primary/25 group-hover:scale-105 transition-transform duration-200">
                      <Download size={20} strokeWidth={2.2} aria-hidden="true" />
                    </div>
                    {/* Unread pulsing indicator dot */}
                    <span
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-brand-primary ring-2 ring-surface-elevated animate-pulse"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-primary/15 text-brand-primary">
                        Install App
                      </span>
                      <span className="text-[11px] text-content-disabled font-medium">
                        Recommended
                      </span>
                    </div>

                    <h3 className="font-bold text-fluid-sm text-content-primary group-hover:text-brand-primary transition-colors line-clamp-1">
                      Install JruJu TV App
                    </h3>
                    <p className="text-[12px] text-content-secondary mt-1 leading-snug line-clamp-2">
                      Install on your mobile or tablet for quick 1-tap access, ad-free kids videos &amp; offline playback.
                    </p>

                    {/* Action buttons row */}
                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
                      {/* Direct Install button */}
                      <button
                        type="button"
                        disabled={installing}
                        onClick={handleDirectInstall}
                        style={{ touchAction: 'manipulation' }}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-brand-primary',
                          'shadow-sm transition-all duration-150',
                          'hover:opacity-90 active:scale-95 active:opacity-75',
                          'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                          'min-h-[36px]',
                          installing && 'opacity-60 cursor-wait'
                        )}
                        aria-label={isInstallable ? 'Install JruJu TV app now' : 'Open install instructions'}
                      >
                        <Download size={13} strokeWidth={2.2} aria-hidden="true" />
                        <span>{installing ? 'Installing…' : 'Install Now'}</span>
                      </button>

                      {/* Open download page button */}
                      <button
                        type="button"
                        onClick={handleOpenDownloadPage}
                        style={{ touchAction: 'manipulation' }}
                        className={cn(
                          'text-[11px] text-content-secondary hover:text-brand-primary',
                          'flex items-center gap-1 font-medium transition-colors',
                          'px-2 py-1.5 rounded-lg hover:bg-surface-secondary/60',
                          'active:opacity-70 active:scale-95',
                          'min-h-[36px]',
                          'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1'
                        )}
                        aria-label="Open download and install page"
                      >
                        <span>Open page</span>
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-8 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-brand-primary/20 blur-xl scale-125" />
                  <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-b from-brand-primary/15 to-brand-primary/5 border border-brand-primary/25 flex items-center justify-center text-brand-primary shadow-lg shadow-brand-primary/10">
                    <Bell size={28} strokeWidth={1.8} className="animate-pulse" aria-hidden="true" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center shadow-sm">
                    <Sparkles size={13} className="text-brand-secondary" />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-[280px]">
                  <p className="font-bold text-fluid-base text-content-primary tracking-tight">
                    {activeTab === 'unread' ? 'No unread notifications' : 'Your inbox is clear'}
                  </p>
                  <p className="text-fluid-xs text-content-secondary leading-relaxed">
                    {activeTab === 'unread'
                      ? "You're all caught up with your latest updates."
                      : "When your favorite channels upload videos, go live, or share updates, they'll show up here."}
                  </p>
                </div>

                <Link
                  href="/videos"
                  onClick={closeNotif}
                  className={cn(
                    'mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full',
                    'text-xs font-semibold text-content-primary bg-surface-secondary',
                    'hover:bg-brand-primary hover:text-white',
                    'border border-border/80 hover:border-transparent',
                    'transition-all duration-200 shadow-sm hover:shadow-md active:scale-95'
                  )}
                >
                  <span>Explore Videos</span>
                </Link>
              </div>
            )}

            {/* Subtle Footer */}
            <div className="px-4 py-2.5 bg-surface-secondary/50 border-t border-border/50 text-center shrink-0">
              <p className="text-[11px] text-content-disabled flex items-center justify-center gap-1">
                {hasInstallNotification ? (
                  <>
                    <Sparkles size={13} className="text-brand-secondary" />
                    <span>Tap notification above to install JruJu TV</span>
                  </>
                ) : (
                  <>
                    <CheckCheck size={13} className="text-green-500" />
                    <span>All notifications are up to date</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
