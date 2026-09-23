'use client';

import { PageShell } from '@/components/layout/PageShell';
import { Download, Smartphone, Tablet, Monitor, CheckCircle2, Share, Plus, Info } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/cn';
import { usePWAStore } from '@/store/pwaStore';

// iOS Add-to-Home-Screen instructions
function IOSInstructions() {
  return (
    <div className="mt-3 rounded-xl border border-brand-primary/30 bg-brand-primary/5 p-4 text-left space-y-2.5">
      <p className="text-fluid-sm font-semibold text-content-primary">
        Add to Home Screen on iOS:
      </p>
      <ol className="space-y-2 text-fluid-sm text-content-secondary list-none">
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-brand-primary text-white text-[10px] font-bold mt-0.5">1</span>
          <span>
            Tap the{' '}
            <Share size={14} className="inline-block text-brand-primary mx-0.5 -mt-0.5" aria-hidden />
            {' '}
            <strong>Share</strong> button in your browser toolbar
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-brand-primary text-white text-[10px] font-bold mt-0.5">2</span>
          <span>
            Scroll down and tap{' '}
            <strong>&ldquo;Add to Home Screen&rdquo;</strong>{' '}
            <Plus size={14} className="inline-block text-brand-primary mx-0.5 -mt-0.5" aria-hidden />
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-brand-primary text-white text-[10px] font-bold mt-0.5">3</span>
          <span>Tap <strong>&ldquo;Add&rdquo;</strong> — JruJu TV appears on your home screen</span>
        </li>
      </ol>
    </div>
  );
}

// Cross-browser manual install instructions (non-iOS, prompt unavailable)
function BrowserInstallInstructions() {
  return (
    <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-left space-y-3">
      <div className="flex items-center gap-2">
        <Info size={15} className="text-blue-500 shrink-0" aria-hidden />
        <p className="text-fluid-sm font-semibold text-content-primary">
          Install from your browser:
        </p>
      </div>
      <ul className="space-y-2.5 text-[12px] text-content-secondary">
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5" aria-hidden />
          <span>
            <strong className="text-content-primary">Chrome / Edge (desktop):</strong>{' '}
            Click the <strong>⊕ Install</strong> icon in the address bar, or open the browser menu (⋮) → <strong>Install JruJu TV</strong>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5" aria-hidden />
          <span>
            <strong className="text-content-primary">Chrome (Android):</strong>{' '}
            Tap the browser menu (⋮) → <strong>Add to Home Screen</strong>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5" aria-hidden />
          <span>
            <strong className="text-content-primary">Firefox:</strong>{' '}
            Tap the menu (≡) → <strong>Install</strong> or <strong>Add to Home Screen</strong>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5" aria-hidden />
          <span>
            <strong className="text-content-primary">Samsung Internet:</strong>{' '}
            Tap the menu → <strong>Add page to</strong> → <strong>Home screen</strong>
          </span>
        </li>
      </ul>
      <p className="text-[11px] text-content-disabled pt-1">
        Tip: Use <strong>Chrome</strong> or <strong>Edge</strong> for the smoothest install experience.
      </p>
    </div>
  );
}

// PWA Install card for the "Smart TV / PWA" slot
function PWAInstallCard() {
  const { isInstallable, isInstalled, isIOSSafari, installDismissed, triggerInstall } = usePWAStore();

  const state: 'installed' | 'installable' | 'ios' | 'dismissed' | 'unavailable' = isInstalled
    ? 'installed'
    : isInstallable
    ? 'installable'
    : isIOSSafari
    ? 'ios'
    : installDismissed
    ? 'dismissed'
    : 'unavailable';

  return (
    <div className="p-6 rounded-2xl bg-surface-secondary border border-border flex flex-col items-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-brand-tertiary/10 text-brand-tertiary flex items-center justify-center">
        <Monitor size={24} />
      </div>
      <h2 className="font-semibold text-fluid-sm text-content-primary">Install as App</h2>
      <p className="text-[12px] text-content-secondary text-center">
        {state === 'installed'
          ? 'JruJu TV is already installed on this device.'
          : 'Install directly from your browser — works on desktop, TV, and Android.'}
      </p>

      {/* Already Installed */}
      {state === 'installed' && (
        <div className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10">
          <CheckCircle2 size={14} />
          Already Installed
        </div>
      )}

      {/* Installable (Chrome / Edge / Android) */}
      {state === 'installable' && (
        <button
          type="button"
          onClick={() => void triggerInstall()}
          style={{ touchAction: 'manipulation' }}
          className={cn(
            'mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-brand-tertiary',
            'hover:opacity-90 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-brand-tertiary'
          )}
        >
          <Download size={14} />
          Install JruJu TV
        </button>
      )}

      {/* iOS Safari */}
      {state === 'ios' && (
        <div className="w-full">
          <button
            type="button"
            disabled
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-brand-tertiary/50 cursor-default"
            aria-label="Follow the instructions below to install on iOS"
          >
            <Share size={14} />
            Add to Home Screen
          </button>
          <IOSInstructions />
        </div>
      )}

      {/* Dismissed */}
      {state === 'dismissed' && (
        <div className="w-full">
          <p className="text-[12px] text-content-secondary text-center">
            You can still install JruJu TV using your browser&apos;s menu:
          </p>
          <BrowserInstallInstructions />
        </div>
      )}

      {/* Unavailable */}
      {state === 'unavailable' && (
        <div className="w-full">
          <p className="text-[12px] text-content-secondary text-center">
            Your browser may support installation via its menu:
          </p>
          <BrowserInstallInstructions />
        </div>
      )}
    </div>
  );
}

// Page
export default function DownloadAppPage() {
  return (
    <PageShell>
      <div className="max-w-2xl mx-auto text-center py-8 px-4 space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" variant="full" />
        </div>

        <div>
          <h1 className="font-display text-fluid-2xl font-bold text-content-primary">
            Download JruJu TV
          </h1>
          <p className="text-fluid-base text-content-secondary mt-2 max-w-md mx-auto">
            Take safe, curated children&apos;s content with you across all your family&apos;s favorite devices.
          </p>
        </div>

        {/* Device platforms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {/* Mobile — placeholder */}
          <div className="p-6 rounded-2xl bg-surface-secondary border border-border flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Smartphone size={24} />
            </div>
            <h2 className="font-semibold text-fluid-sm text-content-primary">Mobile App</h2>
            <p className="text-[12px] text-content-secondary">iOS &amp; Android phones with background audio &amp; safe lock</p>
            <button
              type="button"
              disabled
              title="Native mobile app coming soon"
              className={cn(
                'mt-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-content-disabled',
                'bg-surface-secondary border border-border cursor-not-allowed'
              )}
            >
              Coming Soon
            </button>
          </div>

          {/* Tablet — placeholder */}
          <div className="p-6 rounded-2xl bg-surface-secondary border border-border flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center">
              <Tablet size={24} />
            </div>
            <h2 className="font-semibold text-fluid-sm text-content-primary">Tablet / iPad</h2>
            <p className="text-[12px] text-content-secondary">Designed for little fingers with big buttons and easy navigation</p>
            <button
              type="button"
              disabled
              title="Tablet app coming soon"
              className={cn(
                'mt-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-content-disabled',
                'bg-surface-secondary border border-border cursor-not-allowed'
              )}
            >
              Coming Soon
            </button>
          </div>

          {/* PWA / Smart TV */}
          <PWAInstallCard />
        </div>

        {/* Feature check list */}
        <div className="pt-6 border-t border-border max-w-md mx-auto text-left space-y-2.5">
          <div className="flex items-center gap-2.5 text-fluid-sm text-content-secondary">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>100% ad-free viewing experience for children</span>
          </div>
          <div className="flex items-center gap-2.5 text-fluid-sm text-content-secondary">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Parent-controlled channel allowlists sync automatically</span>
          </div>
          <div className="flex items-center gap-2.5 text-fluid-sm text-content-secondary">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Instant dark &amp; light modes matching ambient lighting</span>
          </div>
          <div className="flex items-center gap-2.5 text-fluid-sm text-content-secondary">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Works offline — UI shell loads even without a connection</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
