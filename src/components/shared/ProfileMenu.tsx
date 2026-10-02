'use client';

import { CircleUser, LogOut, Settings, Shield, ChevronDown, User } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/cn';

export function ProfileMenu() {
  const router = useRouter();
  const { role, user, logout, initialized } = useAuthStore();
  const { openAuthModal } = useUIStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpen(false), open);

  // Keyboard dismissibility (Escape key)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // While reading session from localStorage — show a neutral placeholder
  // so logged-in users don't see "Sign In" button flash briefly
  if (!initialized) {
    return (
      <div
        className="h-8 w-8 rounded-full bg-surface-secondary animate-pulse"
        aria-label="Loading profile…"
        aria-busy="true"
      />
    );
  }

  const isGuest = role === 'guest';

  if (isGuest) {
    return (
      <button
        type="button"
        aria-label="Sign in or create account"
        onClick={openAuthModal}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full',
          'border border-brand-primary text-brand-primary',
          'hover:bg-brand-primary/10 transition-all duration-150',
          'text-fluid-sm font-semibold min-touch',
          'focus-visible:ring-2 focus-visible:ring-brand-primary'
        )}
      >
        <CircleUser size={18} aria-hidden="true" />
        <span className="hidden sm:inline">Sign In</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={`Profile: ${user?.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-full p-0.5',
          'hover:opacity-85 transition-opacity min-touch',
          'focus-visible:ring-2 focus-visible:ring-brand-primary'
        )}
      >
        {/* Avatar circle */}
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
          style={{ background: role === 'parent' ? 'var(--color-brand-primary)' : 'var(--color-brand-tertiary)' }}
          aria-hidden="true"
        >
          {user?.name?.charAt(0).toUpperCase() ?? 'U'}
        </div>
        <ChevronDown size={14} className={cn('text-content-secondary transition-transform duration-200 hidden md:block', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 z-50',
            'w-56 rounded-2xl bg-surface-elevated border border-border shadow-xl',
            'py-1 animate-in slide-in-from-top-2 duration-200'
          )}
          role="menu"
          aria-label="User menu"
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-fluid-sm text-content-primary truncate">{user?.name}</p>
            <p className="text-[11px] text-content-disabled capitalize mt-0.5">
              {role === 'parent' ? 'Parent · Admin' : 'Child Account'}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1" role="none">
            <MenuItem
              icon={User}
              label="My Profile"
              onClick={() => {
                setOpen(false);
                router.push('/profile');
              }}
            />
            {role === 'parent' && (
              <MenuItem
                icon={Shield}
                label="Manage Children"
                onClick={() => {
                  setOpen(false);
                  router.push('/profile');
                }}
              />
            )}
            <MenuItem
              icon={Settings}
              label="Settings"
              onClick={() => {
                setOpen(false);
                router.push('/settings');
              }}
            />
          </div>

          <div className="border-t border-border py-1" role="none">
            <MenuItem
              icon={LogOut}
              label="Log out"
              onClick={() => {
                logout();
                setOpen(false);
                router.push('/');
              }}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5',
        'text-fluid-sm font-medium text-left',
        'transition-colors duration-100 min-touch',
        !danger && !disabled && 'text-content-primary hover:bg-surface-secondary',
        danger && 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30',
        disabled && 'text-content-disabled cursor-not-allowed opacity-60'
      )}
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {disabled && <span className="ml-auto text-[10px] font-normal text-content-disabled">Soon</span>}
    </button>
  );
}

