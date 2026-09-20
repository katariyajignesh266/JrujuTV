'use client';

import { Bell, X, Settings, Sparkles, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { IconButton } from './IconButton';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';
import { useClickOutside } from '@/hooks/useClickOutside';

export function NotificationBell() {
  const { notifOpen, toggleNotif, closeNotif } = useUIStore();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useClickOutside(panelRef, closeNotif, notifOpen);

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

  return (
    <div className="relative" ref={panelRef}>
      <IconButton
        icon={Bell}
        label="Notifications"
        onClick={toggleNotif}
        aria-expanded={notifOpen}
        aria-haspopup="dialog"
      />

      {notifOpen && (
        <>
          {/* Mobile backdrop for high-focus mobile experience */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 sm:hidden animate-in fade-in duration-200"
            onClick={closeNotif}
            aria-hidden="true"
          />

          {/* Notification popup panel */}
          <div
            className={cn(
              // Mobile: Centered floating card with safe margins
              'fixed inset-x-3 top-14 z-50 mx-auto max-w-sm',
              // Laptop/Desktop (sm+ / md+): Perfectly anchored premium dropdown
              'sm:absolute sm:inset-x-auto sm:-right-16 md:-right-20 lg:-right-16 sm:top-full sm:mt-2.5 sm:w-[410px] sm:max-w-none sm:mx-0',
              // Glassmorphism, elevated shadow, border & dark mode styling
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
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 whitespace-nowrap">
                  0 new
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
                All
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
                Unread
              </button>
            </div>

            {/* Scrollable Body - Empty State */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-8 flex flex-col items-center justify-center text-center">
              {/* Premium Glow Icon Badge */}
              <div className="relative mb-4 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-brand-primary/20 blur-xl scale-125" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-b from-brand-primary/15 to-brand-primary/5 border border-brand-primary/25 flex items-center justify-center text-brand-primary shadow-lg shadow-brand-primary/10">
                  <Bell size={28} strokeWidth={1.8} className="animate-pulse" aria-hidden="true" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center shadow-sm">
                  <Sparkles size={13} className="text-brand-secondary" />
                </div>
              </div>

              {/* Text content */}
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

              {/* Action Button */}
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

            {/* Subtle Footer */}
            <div className="px-4 py-2.5 bg-surface-secondary/50 border-t border-border/50 text-center shrink-0">
              <p className="text-[11px] text-content-disabled flex items-center justify-center gap-1">
                <CheckCheck size={13} className="text-green-500" />
                <span>All notifications are up to date</span>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
