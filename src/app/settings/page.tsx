'use client';

import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Settings, Shield, Moon, Bell, Volume2, Globe } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

export default function SettingsPage() {
  const { role } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <div>
          <h1 className="font-display text-fluid-xl font-bold text-content-primary">
            Settings
          </h1>
          <p className="text-fluid-sm text-content-secondary mt-1">
            Manage your viewing preferences and family safety controls
          </p>
        </div>

        {/* Appearance Settings */}
        <div className="rounded-2xl bg-surface-secondary border border-border p-5 space-y-4">
          <h2 className="font-semibold text-fluid-base text-content-primary flex items-center gap-2">
            <Moon size={18} className="text-brand-primary" /> Appearance
          </h2>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <p className="text-fluid-sm font-medium text-content-primary">Theme Mode</p>
              <p className="text-[12px] text-content-secondary">Current: {theme === 'dark' ? 'Dark' : 'Light'}</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                'px-4 py-2 rounded-xl text-fluid-sm font-medium border border-border',
                'bg-surface-elevated hover:border-brand-primary/50 transition-colors'
              )}
            >
              Toggle to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        {/* Parental Controls Section */}
        <div className="rounded-2xl bg-surface-secondary border border-border p-5 space-y-4">
          <h2 className="font-semibold text-fluid-base text-content-primary flex items-center gap-2">
            <Shield size={18} className="text-brand-primary" /> Parental Controls
          </h2>
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-fluid-sm font-medium text-content-primary">Approved Channels Only</p>
                <p className="text-[12px] text-content-secondary">Restrict viewing strictly to channels whitelisted by parents</p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary font-semibold">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div>
                <p className="text-fluid-sm font-medium text-content-primary">Daily Screen Time Limit</p>
                <p className="text-[12px] text-content-secondary">Notify or pause playback when limit is reached</p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface-elevated text-content-secondary border border-border">
                {role === 'parent' ? '45 min/day' : 'Controlled by Parent'}
              </span>
            </div>
          </div>
        </div>

        {/* Playback & Audio */}
        <div className="rounded-2xl bg-surface-secondary border border-border p-5 space-y-4">
          <h2 className="font-semibold text-fluid-base text-content-primary flex items-center gap-2">
            <Volume2 size={18} className="text-brand-primary" /> Audio &amp; Video
          </h2>
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-fluid-sm font-medium text-content-primary">Autoplay Safe Next Video</p>
                <p className="text-[12px] text-content-secondary">Only plays verified child-safe recommendations</p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface-elevated text-content-secondary border border-border">
                Enabled
              </span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

