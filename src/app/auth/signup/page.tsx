'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { Logo } from '@/components/shared/Logo';
import { Shield, User, Mail, MailCheck, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import Link from 'next/link';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const {
    sendSignupMagicLink,
    signInWithGoogle,
    loading,
    error,
    emailConfirmationSent,
    otpEmail,
    clearError,
    resetOtp,
  } = useAuthStore();

  const startCountdown = () => {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await sendSignupMagicLink(email, fullName);
    startCountdown();
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    clearError();
    await sendSignupMagicLink(otpEmail || email, fullName);
    startCountdown();
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

          {!emailConfirmationSent ? (
            <>
              <h1 className="font-display text-fluid-xl font-bold text-content-primary">
                Create Parent Account
              </h1>
              <p className="text-fluid-sm text-content-secondary mt-1 mb-6">
                Set up parental admin controls for JruJu TV
              </p>

              <form onSubmit={handleSignup} className="space-y-4">
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
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className={cn(
                        'w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border',
                        'text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary'
                      )}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary text-[12px] text-content-secondary space-y-1">
                  <p className="font-medium text-content-primary">Simple &amp; Secure:</p>
                  <p>We&apos;ll send a confirmation link to your email. Click it to activate your account instantly — no password needed.</p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white bg-brand-primary',
                    'hover:opacity-90 active:scale-[0.98] transition-all',
                    'focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-60'
                  )}
                >
                  {loading ? 'Sending confirmation…' : 'Create Account & Continue'}
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[12px]">
                    <span className="px-3 bg-surface-elevated text-content-disabled">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={loading}
                  className={cn(
                    'w-full h-11 rounded-xl font-semibold text-fluid-sm',
                    'bg-surface-secondary border border-border text-content-primary',
                    'hover:bg-surface-secondary/80 active:scale-[0.98]',
                    'transition-all duration-150 flex items-center justify-center gap-2.5',
                    'focus-visible:ring-2 focus-visible:ring-brand-primary',
                    'disabled:opacity-70 disabled:cursor-not-allowed'
                  )}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <p className="text-center text-fluid-sm text-content-secondary pt-2">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-brand-primary font-medium hover:underline">
                    Log In
                  </Link>
                </p>
              </form>
            </>
          ) : (
            /* ── EMAIL CONFIRMATION SENT SCREEN ── */
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  <MailCheck size={32} />
                </div>
                <div>
                  <h2 className="font-display text-fluid-lg font-bold text-content-primary">
                    Check your email!
                  </h2>
                  <p className="text-fluid-sm text-content-secondary mt-1">
                    We sent a confirmation link to
                  </p>
                  <p className="font-semibold text-content-primary text-fluid-sm mt-0.5">
                    {otpEmail || email}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-2 text-fluid-sm text-content-secondary">
                <p className="font-medium text-content-primary">Next steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open your email inbox</li>
                  <li>Find the email from <span className="font-medium text-content-primary">JruJuTV</span></li>
                  <li>Click <span className="font-medium text-content-primary">&quot;Confirm email address&quot;</span></li>
                  <li>You&apos;ll be logged in automatically!</li>
                </ol>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">
                  {error}
                </div>
              )}

              <div className="text-center text-fluid-sm text-content-secondary">
                {resendCountdown > 0 ? (
                  <>Resend link in <span className="font-medium text-content-primary">{resendCountdown}s</span></>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-brand-primary font-medium hover:underline disabled:opacity-60"
                  >
                    <RefreshCw size={14} />
                    Resend confirmation email
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => { resetOtp(); clearError(); }}
                className="w-full h-10 rounded-xl text-fluid-sm font-medium border border-border text-content-secondary hover:text-content-primary hover:bg-surface-secondary transition-all"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
