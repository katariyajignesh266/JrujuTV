'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { Logo } from '@/components/shared/Logo';
import { Shield, User, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import Link from 'next/link';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'child' ? 'child' : 'parent';

  const [activeTab, setActiveTab] = useState<'parent' | 'child'>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginAsParent, loginAsChild } = useAuthStore();

  const handleParentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      loginAsParent();
      setIsLoading(false);
      router.push('/');
    }, 600);
  };

  const handleChildLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      loginAsChild('Little Viewer');
      setIsLoading(false);
      router.push('/');
    }, 600);
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="flex justify-center mb-6">
        <Logo size="lg" variant="full" />
      </div>

      <div className="rounded-3xl bg-surface-elevated border border-border p-6 shadow-lg">
        {/* Role switcher tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-surface-secondary mb-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'parent'}
            onClick={() => setActiveTab('parent')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl text-fluid-sm font-semibold transition-all',
              activeTab === 'parent'
                ? 'bg-surface-elevated text-content-primary shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            )}
          >
            <Shield size={16} className={activeTab === 'parent' ? 'text-brand-primary' : ''} />
            Parent Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'child'}
            onClick={() => setActiveTab('child')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl text-fluid-sm font-semibold transition-all',
              activeTab === 'child'
                ? 'bg-surface-elevated text-content-primary shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            )}
          >
            <User size={16} className={activeTab === 'child' ? 'text-brand-tertiary' : ''} />
            Child Login
          </button>
        </div>

        {/* Parent Form */}
        {activeTab === 'parent' && (
          <form onSubmit={handleParentLogin} className="space-y-4">
            <div>
              <h2 className="font-display text-fluid-lg font-bold text-content-primary">
                Welcome back, Parent!
              </h2>
              <p className="text-fluid-sm text-content-secondary mt-0.5">
                Sign in to manage your kids&apos; curated feed
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="parent-login-email">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="parent-login-email"
                  type="email"
                  required
                  placeholder="parent@example.com"
                  className={cn(
                    'w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border',
                    'text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary'
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="parent-login-pass">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="parent-login-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className={cn(
                    'w-full h-11 pl-10 pr-10 rounded-xl bg-surface-secondary border border-border',
                    'text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary'
                  )}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-disabled hover:text-content-secondary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white bg-brand-primary',
                'hover:opacity-90 active:scale-[0.98] transition-all',
                'focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-60'
              )}
            >
              {isLoading ? 'Signing In…' : 'Log In as Parent'}
            </button>

            <p className="text-center text-fluid-sm text-content-secondary pt-2">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-brand-primary font-medium hover:underline">
                Sign Up
              </Link>
            </p>
          </form>
        )}

        {/* Child Form */}
        {activeTab === 'child' && (
          <form onSubmit={handleChildLogin} className="space-y-4">
            <div>
              <h2 className="font-display text-fluid-lg font-bold text-content-primary">
                Child Login
              </h2>
              <p className="text-fluid-sm text-content-secondary mt-0.5">
                Enter the credentials your parent set up for you
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="child-login-user">
                Child Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="child-login-user"
                  type="text"
                  required
                  placeholder="e.g. little-krishna"
                  className={cn(
                    'w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border',
                    'text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-tertiary'
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="child-login-pass">
                Password / PIN
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="child-login-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••"
                  className={cn(
                    'w-full h-11 pl-10 pr-10 rounded-xl bg-surface-secondary border border-border',
                    'text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-tertiary'
                  )}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-disabled hover:text-content-secondary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white',
                'hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60'
              )}
              style={{ background: 'var(--color-brand-tertiary)' }}
            >
              {isLoading ? 'Starting JruJu TV…' : 'Start Watching'}
            </button>

            {/* Child login does NOT show signup link per specification */}
            <p className="text-center text-[12px] text-content-disabled pt-2">
              Only parents can create child accounts.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PageShell>
      <Suspense fallback={<div className="p-8 text-center text-content-secondary">Loading login...</div>}>
        <LoginFormContent />
      </Suspense>
    </PageShell>
  );
}

