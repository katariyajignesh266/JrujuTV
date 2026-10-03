'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/layout/PageShell';
import {
  Shield,
  Moon,
  Volume2,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

export default function SettingsPage() {
  const { role, deleteAccount } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // ── Delete Account modal state ──────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const CONFIRM_PHRASE = 'DELETE';

  const handleDeleteAccount = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // deleteAccount clears session → user is now guest, redirect home
      router.replace('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleteLoading(false);
    }
  };

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

        {/* ── Danger Zone: Delete Account ─────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-secondary border border-red-500/30 p-5 space-y-4">
          <h2 className="font-semibold text-fluid-base text-red-500 flex items-center gap-2">
            <AlertTriangle size={18} /> Danger Zone
          </h2>
          <div className="border-t border-border/60 pt-4 space-y-3">
            <div>
              <p className="text-fluid-sm font-semibold text-content-primary">Delete Account</p>
              <p className="text-[12px] text-content-secondary mt-0.5">
                Permanently delete your account and all associated data.
                {role === 'parent' && ' All child accounts linked to your profile will also be removed.'}
                {' '}This action cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmText('');
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                'bg-red-500/10 border border-red-500/30 text-red-500',
                'text-fluid-sm font-semibold',
                'hover:bg-red-500/20 active:scale-95 transition-all duration-150'
              )}
            >
              <Trash2 size={16} />
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL ───────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-surface-elevated rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-fluid-lg text-content-primary leading-tight">
                    Delete Account
                  </h3>
                  <p className="text-[11px] text-red-400 font-medium">This cannot be undone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="text-content-secondary hover:text-content-primary rounded-full p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning body */}
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/[0.08] border border-red-500/20 space-y-1.5">
              <p className="text-fluid-sm text-content-secondary leading-relaxed">
                Your account, profile, preferences
                {role === 'parent' && ', and all child accounts'}
                {' '}will be{' '}
                <span className="font-semibold text-red-400">permanently deleted</span> from our servers.
              </p>
              <p className="text-fluid-sm text-content-secondary">
                You <span className="font-semibold text-content-primary">can</span> sign up again with the same email later.
              </p>
            </div>

            {/* Confirm text input */}
            <div className="space-y-1.5 mb-4">
              <label className="text-fluid-sm font-medium text-content-primary block">
                Type <span className="font-bold text-red-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="DELETE"
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  'w-full h-11 px-4 rounded-xl text-fluid-sm font-medium tracking-widest',
                  'bg-surface-secondary border text-content-primary',
                  'focus:outline-none focus:ring-2',
                  confirmText === CONFIRM_PHRASE
                    ? 'border-red-500 focus:ring-red-500/40'
                    : 'border-border focus:ring-brand-primary/40'
                )}
              />
            </div>

            {/* Error */}
            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">
                {deleteError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className={cn(
                  'flex-1 h-11 rounded-xl font-semibold text-fluid-sm',
                  'bg-surface-secondary border border-border text-content-secondary',
                  'hover:bg-surface-elevated transition-colors disabled:opacity-60'
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmText !== CONFIRM_PHRASE || deleteLoading}
                className={cn(
                  'flex-1 h-11 rounded-xl font-semibold text-fluid-sm',
                  'bg-red-500 text-white',
                  'hover:bg-red-600 active:scale-[0.98] transition-all',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {deleteLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

