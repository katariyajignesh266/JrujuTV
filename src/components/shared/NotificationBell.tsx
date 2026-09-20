'use client';

import { Bell, X, Info } from 'lucide-react';
import { IconButton } from './IconButton';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';
import { useRef, useEffect } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

export function NotificationBell() {
  const { notifOpen, toggleNotif, closeNotif } = useUIStore();
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
        <div
          className={cn(
            'absolute right-0 top-full mt-2 z-50',
            'w-[calc(100vw-32px)] sm:w-80 max-w-sm', // Responsive width: never overflows on 320px screens
            'max-h-[70dvh] overflow-y-auto',
            'rounded-2xl bg-surface-elevated border border-border shadow-xl',
            'animate-in slide-in-from-top-2 duration-200'
          )}
          role="dialog"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-fluid-base text-content-primary">Notifications</h2>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={closeNotif}
              className="text-content-secondary hover:text-content-primary min-touch flex items-center justify-center rounded-full hover:bg-surface-secondary transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Empty state */}
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <div className="h-12 w-12 rounded-full bg-surface-secondary flex items-center justify-center">
              <Info size={22} strokeWidth={1.5} className="text-content-disabled" aria-hidden="true" />
            </div>
            <p className="text-fluid-sm text-content-secondary">
              No notifications yet.
              <br />
              New activity will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
