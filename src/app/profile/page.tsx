'use client';

import { PageShell } from '@/components/layout/PageShell';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { CircleUser, Shield, Settings, LogOut, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function ProfilePage() {
  const { role, user, logout } = useAuthStore();
  const { openAuthModal } = useUIStore();
  const isGuest = role === 'guest';

  if (isGuest) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-6 text-center px-6">
          <div className="h-24 w-24 rounded-full bg-surface-secondary flex items-center justify-center">
            <CircleUser size={44} strokeWidth={1.25} className="text-content-disabled" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-fluid-xl font-bold text-content-primary mb-2">You</h1>
            <p className="text-fluid-sm text-content-secondary mb-6">
              Sign in to manage your JruJu TV experience
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-full',
                'bg-brand-primary text-white font-semibold text-fluid-sm',
                'hover:opacity-90 active:scale-95 transition-all duration-150',
                'focus-visible:ring-2 focus-visible:ring-brand-primary'
              )}
            >
              <CircleUser size={18} aria-hidden="true" />
              Sign In
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-lg mx-auto">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 py-8">
          <div
            className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md"
            style={{ background: role === 'parent' ? 'var(--color-brand-primary)' : 'var(--color-brand-tertiary)' }}
            aria-hidden="true"
          >
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <h1 className="font-display text-fluid-xl font-bold text-content-primary">{user?.name}</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full text-[11px] font-semibold',
                role === 'parent'
                  ? 'bg-brand-primary/15 text-brand-primary'
                  : 'text-white'
              )}
              style={role === 'child' ? { background: 'var(--color-brand-tertiary)' } : {}}
            >
              {role === 'parent' ? <Shield size={12} aria-hidden="true" /> : <Star size={12} aria-hidden="true" />}
              {role === 'parent' ? 'Parent · Admin' : 'Child Account'}
            </span>
          </div>
        </div>

        {/* Menu list */}
        <div className="space-y-2">
          {role === 'parent' && (
            <ProfileSection title="Admin">
              <ProfileItem icon={Shield} label="Manage Children" badge="Soon" />
              <ProfileItem icon={CircleUser} label="Add Child Account" badge="Soon" />
            </ProfileSection>
          )}

          <ProfileSection title="Account">
            <ProfileItem icon={CircleUser} label="Edit Profile" />
            <ProfileItem icon={Settings} label="Settings" />
          </ProfileSection>

          <ProfileSection title="">
            <ProfileItem
              icon={LogOut}
              label="Log Out"
              danger
              onClick={logout}
            />
          </ProfileSection>
        </div>
      </div>
    </PageShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-secondary border border-border overflow-hidden">
      {title && (
        <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-content-disabled uppercase tracking-wider">
          {title}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

function ProfileItem({
  icon: Icon,
  label,
  badge,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px]',
        'border-t border-border first:border-t-0',
        'text-left transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
          : 'text-content-primary hover:bg-surface-elevated'
      )}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      <span className="flex-1 text-fluid-sm font-medium">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold text-content-disabled border border-border px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {!badge && !danger && (
        <ChevronRight size={16} className="text-content-disabled shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

