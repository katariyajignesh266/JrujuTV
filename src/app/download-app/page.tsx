'use client';

import { PageShell } from '@/components/layout/PageShell';
import { Download, Smartphone, Tablet, Monitor, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/cn';

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
          <div className="p-6 rounded-2xl bg-surface-secondary border border-border flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Smartphone size={24} />
            </div>
            <h2 className="font-semibold text-fluid-sm text-content-primary">Mobile App</h2>
            <p className="text-[12px] text-content-secondary">iOS &amp; Android phones with background audio &amp; safe lock</p>
            <button
              type="button"
              className={cn(
                'mt-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-brand-primary',
                'hover:opacity-90 active:scale-95 transition-all'
              )}
            >
              Get for Mobile
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-surface-secondary border border-border flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center">
              <Tablet size={24} />
            </div>
            <h2 className="font-semibold text-fluid-sm text-content-primary">Tablet / iPad</h2>
            <p className="text-[12px] text-content-secondary">Designed for little fingers with big buttons and easy navigation</p>
            <button
              type="button"
              className={cn(
                'mt-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-brand-secondary',
                'hover:opacity-90 active:scale-95 transition-all'
              )}
            >
              Get for Tablet
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-surface-secondary border border-border flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-tertiary/10 text-brand-tertiary flex items-center justify-center">
              <Monitor size={24} />
            </div>
            <h2 className="font-semibold text-fluid-sm text-content-primary">Smart TV / PWA</h2>
            <p className="text-[12px] text-content-secondary">Install as progressive web app directly on your TV browser</p>
            <button
              type="button"
              className={cn(
                'mt-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-brand-tertiary',
                'hover:opacity-90 active:scale-95 transition-all'
              )}
            >
              Install PWA
            </button>
          </div>
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
        </div>
      </div>
    </PageShell>
  );
}

