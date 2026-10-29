// src/components/settings/PushNotificationSettings.tsx
// Premium-styled notification opt-in / opt-out card for parent Settings page.
// Detects iOS Safari (install-first gate), permission state, and gracefully
// handles denied/revoked permission with re-enable instructions.

'use client';

import { Bell, BellOff, BellRing, Smartphone, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePushNotifications, type PushPermissionState } from '@/hooks/usePushNotifications';

function StateIcon({ state }: { state: PushPermissionState }) {
  if (state === 'subscribed') return <BellRing size={18} className="text-emerald-500" />;
  if (state === 'denied') return <BellOff size={18} className="text-red-500" />;
  return <Bell size={18} className="text-brand-primary" />;
}

function StatePill({ state }: { state: PushPermissionState }) {
  if (state === 'subscribed') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
        <CheckCircle2 size={11} /> On
      </span>
    );
  }
  if (state === 'denied') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-semibold border border-red-500/20">
        <BellOff size={11} /> Off
      </span>
    );
  }
  return null;
}

export function PushNotificationSettings() {
  const { permissionState, subscribing, unsubscribing, error, subscribe, unsubscribe } =
    usePushNotifications();

  // Still detecting state
  if (permissionState === 'loading') {
    return (
      <div className="flex items-center gap-2 py-3 text-content-secondary text-fluid-sm">
        <Loader2 size={15} className="animate-spin" />
        <span>Checking notification status…</span>
      </div>
    );
  }

  // Browser doesn't support Web Push at all
  if (permissionState === 'unsupported') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-elevated border border-border text-fluid-sm text-content-secondary">
        <Info size={16} className="shrink-0 mt-0.5 text-content-disabled" />
        <p>
          Push notifications are not supported in this browser. Try Chrome or Edge on desktop,
          or Chrome on Android.
        </p>
      </div>
    );
  }

  // iOS Safari in browser tab — must install PWA first
  if (permissionState === 'ios-needs-install') {
    return (
      <div className="p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-fluid-sm font-semibold text-amber-700 dark:text-amber-300">
            Install the app to enable notifications
          </p>
        </div>
        <p className="text-[12px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
          iOS Safari only supports push notifications for installed PWAs. Tap the{' '}
          <strong>Share</strong> button in Safari, then select{' '}
          <strong>Add to Home Screen</strong> — then open the app from your home screen and
          return here to enable notifications.
        </p>
      </div>
    );
  }

  // Permission was denied by the user — cannot re-prompt, must guide to OS settings
  if (permissionState === 'denied') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StateIcon state={permissionState} />
            <div>
              <p className="text-fluid-sm font-medium text-content-primary">Notifications</p>
              <p className="text-[11px] text-content-secondary">
                Blocked at the browser or OS level
              </p>
            </div>
          </div>
          <StatePill state={permissionState} />
        </div>
        <div className="p-3.5 rounded-2xl bg-red-500/[0.06] border border-red-500/15 text-[12px] text-content-secondary leading-relaxed">
          <p className="font-semibold text-red-600 dark:text-red-400 mb-1">Notifications are blocked</p>
          <p>
            To re-enable: open your browser or OS <strong>Settings → Notifications</strong>,
            find <strong>JruJu TV</strong>, and allow notifications. Then return here to
            activate them.
          </p>
        </div>
      </div>
    );
  }

  // Subscribed — show "On" state with option to disable
  if (permissionState === 'subscribed') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StateIcon state={permissionState} />
            <div>
              <p className="text-fluid-sm font-medium text-content-primary">Notifications</p>
              <p className="text-[11px] text-content-secondary">
                You&apos;ll be notified when a child opens JruJu TV
              </p>
            </div>
          </div>
          <StatePill state={permissionState} />
        </div>
        {error && (
          <p className="text-[12px] text-red-500 bg-red-500/8 rounded-xl px-3 py-2 border border-red-500/15">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={unsubscribe}
          disabled={unsubscribing}
          className={cn(
            'w-full h-10 rounded-xl text-fluid-sm font-semibold flex items-center justify-center gap-2',
            'bg-surface-elevated border border-border text-content-secondary',
            'hover:border-red-500/30 hover:text-red-500 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {unsubscribing ? (
            <><Loader2 size={15} className="animate-spin" /> Disabling…</>
          ) : (
            <><BellOff size={15} /> Disable Notifications</>
          )}
        </button>
      </div>
    );
  }

  // Default: permission not yet granted — show the premium opt-in CTA
  return (
    <div className="space-y-4">
      {/* Feature explanation card */}
      <div className="p-4 rounded-2xl bg-brand-primary/[0.05] border border-brand-primary/15 space-y-1.5">
        <p className="text-fluid-sm font-semibold text-content-primary flex items-center gap-1.5">
          <BellRing size={15} className="text-brand-primary" />
          Know when your child starts watching
        </p>
        <p className="text-[12px] text-content-secondary leading-relaxed">
          Get a real notification on your device — even when JruJu TV is closed — the moment
          a child account opens the app. Works like a WhatsApp message notification.
        </p>
      </div>

      {error && (
        <p className="text-[12px] text-red-500 bg-red-500/8 rounded-xl px-3 py-2 border border-red-500/15">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={subscribe}
        disabled={subscribing}
        className={cn(
          'w-full h-11 rounded-xl text-fluid-sm font-bold flex items-center justify-center gap-2',
          'bg-gradient-to-r from-brand-primary to-rose-600 text-white shadow-md shadow-brand-primary/25',
          'hover:shadow-lg hover:shadow-brand-primary/30 hover:scale-[1.01]',
          'active:scale-[0.99] transition-all duration-150',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none'
        )}
      >
        {subscribing ? (
          <><Loader2 size={16} className="animate-spin" /> Enabling…</>
        ) : (
          <><Bell size={16} /> Enable Notifications</>
        )}
      </button>

      <p className="text-[11px] text-content-disabled text-center">
        Your browser will ask to allow notifications — tap <strong>Allow</strong> to proceed.
        You can disable anytime from Settings.
      </p>
    </div>
  );
}

