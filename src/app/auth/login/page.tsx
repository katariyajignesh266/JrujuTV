'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { Logo } from '@/components/shared/Logo';
import { Shield, User, Lock, Mail, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import Link from 'next/link';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'child' ? 'child' : 'parent';

  const [activeTab, setActiveTab] = useState<'parent' | 'child'>(initialRole);
  const [showPassword, setShowPassword] = useState(false);

  // Parent OTP state
  const [parentEmail, setParentEmail] = useState('');
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Child state
  const [childUsername, setChildUsername] = useState('');
  const [childPassword, setChildPassword] = useState('');

  const {
    sendOtp,
    verifyOtp,
    signInWithGoogle,
    childLogin,
    loading,
    error,
    otpSent,
    role,
    session,
    initialized,
    clearError,
    resetOtp,
  } = useAuthStore();

  useEffect(() => {
    if (initialized && (session || role !== 'guest')) {
      router.replace('/profile');
    }
  }, [initialized, session, role, router]);

  const handleTabSwitch = (tab: 'parent' | 'child') => {
    setActiveTab(tab);
    clearError();
    resetOtp();
    setShowOtpStep(false);
  };

  useEffect(() => {
    if (!showOtpStep || countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [showOtpStep, countdown]);

  useEffect(() => {
    if (otpSent && activeTab === 'parent') {
      setShowOtpStep(true);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [otpSent, activeTab]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await sendOtp(parentEmail, false);
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    clearError();
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (val && i === 5 && next.join('').length === 6) {
      verifyOtp(parentEmail, next.join('')).then(() => {
        if (useAuthStore.getState().session) router.push('/');
      });
    }
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtp(next);
    if (pasted.length === 6) {
      otpRefs.current[5]?.focus();
      verifyOtp(parentEmail, pasted).then(() => {
        if (useAuthStore.getState().session) router.push('/');
      });
    } else {
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    clearError();
    await sendOtp(parentEmail, false);
    setCountdown(60);
    setOtp(['', '', '', '', '', '']);
    otpRefs.current[0]?.focus();
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length === 6) {
      await verifyOtp(parentEmail, token);
      if (useAuthStore.getState().session) router.push('/');
    }
  };

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await childLogin(childUsername, childPassword);
    if (useAuthStore.getState().session) router.push('/');
  };

  if (session || role !== 'guest') {
    return (
      <div className="flex items-center justify-center min-h-[50dvh]">
        <div className="h-8 w-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="flex justify-center mb-6">
        <Logo size="lg" variant="full" />
      </div>

      <div className="rounded-3xl bg-surface-elevated border border-border p-6 shadow-lg">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-surface-secondary mb-6" role="tablist">
          <button
            type="button" role="tab"
            aria-selected={activeTab === 'parent'}
            onClick={() => handleTabSwitch('parent')}
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
            type="button" role="tab"
            aria-selected={activeTab === 'child'}
            onClick={() => handleTabSwitch('child')}
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

        {/* ── PARENT ── */}
        {activeTab === 'parent' && !showOtpStep && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <h2 className="font-display text-fluid-lg font-bold text-content-primary">Welcome back, Parent!</h2>
              <p className="text-fluid-sm text-content-secondary mt-0.5">Sign in with a one-time code — no password needed</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="parent-email">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input
                  id="parent-email" type="email" required
                  value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-fluid-sm text-white bg-brand-primary hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-60">
              {loading ? 'Sending code…' : 'Log In'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-[12px]"><span className="px-3 bg-surface-elevated text-content-disabled">or</span></div>
            </div>

            <button type="button" onClick={signInWithGoogle} disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-fluid-sm bg-surface-secondary border border-border text-content-primary hover:bg-surface-secondary/80 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-70">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-fluid-sm text-content-secondary pt-2">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-brand-primary font-medium hover:underline">Sign Up</Link>
            </p>
          </form>
        )}

        {/* ── OTP STEP ── */}
        {activeTab === 'parent' && showOtpStep && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <button type="button"
              onClick={() => { setShowOtpStep(false); clearError(); resetOtp(); }}
              className="text-content-secondary hover:text-content-primary flex items-center gap-1 text-fluid-sm -ml-1 transition-colors">
              <ChevronLeft size={18} /> Change email
            </button>
            <div>
              <h2 className="font-display text-fluid-lg font-bold text-content-primary">Enter Verification Code</h2>
              <p className="text-fluid-sm text-content-secondary mt-0.5">
                Sent to <span className="font-medium text-content-primary">{parentEmail}</span>
              </p>
            </div>

            <div className="flex justify-center gap-2.5 my-2" onPaste={handleOtpPaste}>
              {otp.map((d, i) => (
                <input key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className={cn(
                    'w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl bg-surface-secondary border-2',
                    d ? 'border-brand-primary' : 'border-border',
                    'text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary'
                  )}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-fluid-sm text-white bg-brand-primary hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-60">
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <p className="text-center text-fluid-sm text-content-secondary">
              {countdown > 0
                ? <>Resend in <span className="font-medium text-content-primary">{countdown}s</span></>
                : <button type="button" onClick={handleResend} className="text-brand-primary font-medium hover:underline">Resend code</button>}
            </p>
          </form>
        )}

        {/* ── CHILD ── */}
        {activeTab === 'child' && (
          <form onSubmit={handleChildSubmit} className="space-y-4">
            <div>
              <h2 className="font-display text-fluid-lg font-bold text-content-primary">Child Login</h2>
              <p className="text-fluid-sm text-content-secondary mt-0.5">Enter the credentials your parent set up for you</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="child-username">Child Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input id="child-username" type="text" required
                  value={childUsername} onChange={e => setChildUsername(e.target.value)}
                  placeholder="e.g. little-krishna"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-tertiary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="child-pass">Password / PIN</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                <input id="child-pass" type={showPassword ? 'text' : 'password'} required
                  value={childPassword} onChange={e => setChildPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-secondary border border-border text-fluid-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-tertiary"
                />
                <button type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-disabled hover:text-content-secondary">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-fluid-sm text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
              style={{ background: 'var(--color-brand-tertiary)' }}>
              {loading ? 'Starting JruJu TV…' : 'Start Watching'}
            </button>

            <p className="text-center text-[12px] text-content-disabled pt-2">Only parents can create child accounts.</p>
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

