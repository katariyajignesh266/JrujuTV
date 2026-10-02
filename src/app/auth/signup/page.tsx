'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { Logo } from '@/components/shared/Logo';
import { Shield, User, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginAsParent } = useAuthStore();

  const handleParentSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      loginAsParent();
      setIsLoading(false);
      router.push('/');
    }, 800);
  };

  return (
    <PageShell>
      <div className="max-w-md mx-auto py-8 px-4">
        <div className="flex justify-center mb-6">
          <Logo size="lg" variant="full" />
        </div>

        <div className="rounded-3xl bg-surface-elevated border border-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Shield size={18} />
            </div>
            <span className="text-[12px] font-semibold text-brand-primary uppercase tracking-wider">
              Parent Registration
            </span>
          </div>

          <h1 className="font-display text-fluid-xl font-bold text-content-primary">
            Create Parent Account
          </h1>
          <p className="text-fluid-sm text-content-secondary mt-1 mb-6">
            Set up parental admin controls for JruJu TV
          </p>

          <form onSubmit={handleParentSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="signup-name">
                Full Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="e.g. Radhika Sharma"
                  className={cn(
                    'w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border',
                    'text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary'
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="signup-email">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="signup-email"
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
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="signup-password">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 8 characters"
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

            <div className="p-3 rounded-xl bg-surface-secondary text-[12px] text-content-secondary space-y-1">
              <p className="font-medium text-content-primary">Parental Guarantee:</p>
              <p>You have full authority to whitelist approved YouTube channels and videos for your kids.</p>
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
              {isLoading ? 'Creating Account…' : 'Sign Up & Continue'}
            </button>

            <p className="text-center text-fluid-sm text-content-secondary pt-2">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-brand-primary font-medium hover:underline">
                Log In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

