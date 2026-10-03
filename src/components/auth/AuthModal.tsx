'use client';

import { X, Shield, User, Lock, Mail, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/shared/Logo';
import { useClickOutside } from '@/hooks/useClickOutside';

type Step = 'choice' | 'parent-login' | 'parent-signup' | 'otp-verify' | 'child-login';

export function AuthModal() {
  const { authModalOpen, closeAuthModal } = useUIStore();
  const { loading, error, otpSent, clearError, resetOtp } = useAuthStore();
  const [step, setStep] = useState<Step>('choice');
  const [showPassword, setShowPassword] = useState(false);
  const [prevStep, setPrevStep] = useState<Step>('parent-login');
  const [signupName, setSignupName] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useClickOutside(modalRef, closeAuthModal, authModalOpen);

  useEffect(() => {
    if (otpSent && (step === 'parent-login' || step === 'parent-signup')) {
      setPrevStep(step);
      setStep('otp-verify');
    }
  }, [otpSent, step]);

  const handleClose = useCallback(() => {
    closeAuthModal();
    setStep('choice');
    clearError();
    resetOtp();
    setSignupName('');
  }, [closeAuthModal, clearError, resetOtp]);

  const handleBack = useCallback(() => {
    clearError();
    if (step === 'otp-verify') {
      resetOtp();
      setStep(prevStep);
    } else {
      setStep('choice');
    }
  }, [step, prevStep, clearError, resetOtp]);

  useEffect(() => {
    if (!authModalOpen) return;

    triggerRef.current = document.activeElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled])'
        );
        firstFocusable?.focus();
      }
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (triggerRef.current instanceof HTMLElement) {
        (triggerRef.current as HTMLElement).focus();
      }
    };
  }, [authModalOpen, step, handleClose]);

  if (!authModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={step === 'choice' ? 'Sign in to JruJu TV' : undefined}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" onClick={handleClose} />

      <div
        ref={modalRef}
        className={cn(
          'relative z-10 w-full sm:max-w-md',
          'bg-surface-elevated rounded-t-3xl sm:rounded-3xl',
          'shadow-xl border border-border',
          'max-h-[92dvh] overflow-y-auto',
          'animate-in slide-in-from-bottom-4 duration-300'
        )}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 pb-2 bg-surface-elevated/95 backdrop-blur-sm border-b border-border/40">
          {step !== 'choice' ? (
            <button
              type="button"
              aria-label="Go back"
              onClick={handleBack}
              className="text-content-secondary hover:text-content-primary min-touch flex items-center justify-center -ml-1 rounded-full hover:bg-surface-secondary transition-colors"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            aria-label="Close dialog"
            onClick={handleClose}
            className="text-content-secondary hover:text-content-primary min-touch flex items-center justify-center -mr-1 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 sm:px-6 pt-2 pb-8">
          <div className="flex justify-center mb-5">
            <Logo size="md" variant="full" />
          </div>

          {step === 'choice' && (
            <>
              <h1 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
                Welcome to JruJu TV
              </h1>
              <p className="text-fluid-sm text-content-secondary text-center mb-6">
                Choose how you&apos;d like to continue
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep('parent-login')}
                  className={cn(
                    'w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl text-left',
                    'border-2 border-brand-primary/25 bg-brand-primary/5',
                    'hover:border-brand-primary/60 hover:bg-brand-primary/10',
                    'transition-all duration-200 group min-touch',
                    'focus-visible:ring-2 focus-visible:ring-brand-primary'
                  )}
                >
                  <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 bg-brand-primary text-white shadow-sm">
                    <Shield size={22} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-fluid-base text-content-primary">Continue as Parent</p>
                    <p className="text-fluid-sm text-content-secondary mt-0.5 line-clamp-2">
                      Sign up or log in · Full parental admin controls
                    </p>
                  </div>
                  <span className="text-brand-primary shrink-0 text-xl leading-none font-bold">›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('child-login')}
                  className={cn(
                    'w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl text-left',
                    'border-2 border-brand-tertiary/25 bg-brand-tertiary/5',
                    'hover:border-brand-tertiary/60 hover:bg-brand-tertiary/10',
                    'transition-all duration-200 group min-touch',
                    'focus-visible:ring-2 focus-visible:ring-brand-tertiary'
                  )}
                >
                  <div
                    className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm"
                    style={{ background: 'var(--color-brand-tertiary)' }}
                  >
                    <User size={22} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-fluid-base text-content-primary">Child Login</p>
                    <p className="text-fluid-sm text-content-secondary mt-0.5 line-clamp-2">
                      Use the username &amp; PIN your parent set up
                    </p>
                  </div>
                  <span className="text-brand-tertiary shrink-0 text-xl leading-none font-bold">›</span>
                </button>
              </div>
            </>
          )}

          {step === 'parent-login' && (
            <ParentLoginForm
              onSignupClick={() => { clearError(); setStep('parent-signup'); }}
            />
          )}

          {step === 'parent-signup' && (
            <ParentSignupForm
              onLoginClick={() => { clearError(); setStep('parent-login'); }}
              signupName={signupName}
              setSignupName={setSignupName}
            />
          )}

          {step === 'otp-verify' && (
            <OtpVerifyForm
              onClose={handleClose}
              signupName={prevStep === 'parent-signup' ? signupName : undefined}
            />
          )}

          {step === 'child-login' && (
            <ChildLoginForm
              onClose={handleClose}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FormInput({
  label,
  id,
  type = 'text',
  placeholder,
  icon: Icon,
  suffix,
  value,
  onChange,
  required = false,
  autoFocus = false,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder: string;
  icon: React.ElementType;
  suffix?: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-fluid-sm font-medium text-content-primary block">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled pointer-events-none">
          <Icon size={16} aria-hidden="true" />
        </span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoFocus={autoFocus}
          className={cn(
            'w-full h-11 pl-10 pr-10 rounded-xl',
            'bg-surface-secondary border border-border',
            'text-fluid-sm text-content-primary placeholder:text-content-disabled',
            'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary',
            'transition-all duration-150'
          )}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ label, isLoading }: { label: string; isLoading: boolean }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={cn(
        'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white',
        'bg-brand-primary hover:opacity-90 active:scale-[0.98]',
        'transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
        'disabled:opacity-70 disabled:cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
          Please wait…
        </span>
      ) : label}
    </button>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">
      {message}
    </div>
  );
}

function GoogleButton() {
  const { signInWithGoogle, loading } = useAuthStore();

  return (
    <>
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
          'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
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
    </>
  );
}

function ParentLoginForm({
  onSignupClick,
}: {
  onSignupClick: () => void;
}) {
  const { sendOtp, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp(email, false);
  };

  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Parent Login
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-5">
        Access your parental admin dashboard
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormInput
          label="Email Address"
          id="parent-email"
          type="email"
          placeholder="parent@example.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <ErrorMessage message={error} />
        <SubmitButton label="Log In" isLoading={loading} />
      </form>
      <GoogleButton />
      <p className="text-center text-fluid-sm text-content-secondary mt-4">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSignupClick}
          className="text-brand-primary font-medium hover:underline focus-visible:underline"
        >
          Sign Up
        </button>
      </p>
    </>
  );
}

function ParentSignupForm({
  onLoginClick,
  signupName,
  setSignupName,
}: {
  onLoginClick: () => void;
  signupName: string;
  setSignupName: (v: string) => void;
}) {
  const { sendOtp, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp(email, true, signupName);
  };

  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Create Parent Account
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-5">
        Set up your family&apos;s safe viewing controls
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormInput
          label="Full Name"
          id="signup-name"
          placeholder="Your name"
          icon={User}
          value={signupName}
          onChange={(e) => setSignupName(e.target.value)}
          required
          autoFocus
        />
        <FormInput
          label="Email Address"
          id="signup-email"
          type="email"
          placeholder="parent@example.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <ErrorMessage message={error} />
        <SubmitButton label="Create Account &amp; Continue" isLoading={loading} />
      </form>
      <GoogleButton />
      <p className="text-center text-fluid-sm text-content-secondary mt-4">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onLoginClick}
          className="text-brand-primary font-medium hover:underline focus-visible:underline"
        >
          Log In
        </button>
      </p>
    </>
  );
}

function OtpVerifyForm({
  onClose,
  signupName,
}: {
  onClose: () => void;
  signupName?: string;
}) {
  const { verifyOtp, sendOtp, loading, error, otpEmail, clearError } = useAuthStore();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    clearError();

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6 && otpEmail) {
        verifyOtp(otpEmail, fullOtp, signupName).then(() => {
          const { session } = useAuthStore.getState();
          if (session) onClose();
        });
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    if (pasted.length === 6 && otpEmail) {
      inputRefs.current[5]?.focus();
      verifyOtp(otpEmail, pasted, signupName).then(() => {
        const { session } = useAuthStore.getState();
        if (session) onClose();
      });
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !otpEmail) return;
    clearError();
    await sendOtp(otpEmail, true, signupName);
    setCountdown(60);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length === 6 && otpEmail) {
      await verifyOtp(otpEmail, fullOtp, signupName);
      const { session } = useAuthStore.getState();
      if (session) onClose();
    }
  };

  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Enter Verification Code
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-6">
        We sent a 6-digit code to{' '}
        <span className="font-medium text-content-primary">{otpEmail}</span>
      </p>
      <form className="space-y-4" onSubmit={handleManualSubmit}>
        <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={cn(
                'w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl',
                'bg-surface-secondary border-2',
                digit ? 'border-brand-primary' : 'border-border',
                'text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary'
              )}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        <ErrorMessage message={error} />

        <SubmitButton
          label="Verify"
          isLoading={loading}
        />

        <p className="text-center text-fluid-sm text-content-secondary">
          {countdown > 0 ? (
            <>Resend code in <span className="font-medium text-content-primary">{countdown}s</span></>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-brand-primary font-medium hover:underline focus-visible:underline"
            >
              Resend code
            </button>
          )}
        </p>
      </form>
    </>
  );
}

function ChildLoginForm({
  onClose,
  showPassword,
  setShowPassword,
}: {
  onClose: () => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  const { childLogin, loading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await childLogin(username, password);
    const { session } = useAuthStore.getState();
    if (session) onClose();
  };

  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Child Login
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-5">
        Use the credentials your parent set up for you
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormInput
          label="Username"
          id="child-username"
          placeholder="your-username"
          icon={User}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
        <FormInput
          label="Password / PIN"
          id="child-password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          suffix={
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              className="text-content-disabled hover:text-content-secondary w-10 h-10 -mr-2 flex items-center justify-center rounded-lg transition-colors focus-visible:ring-1 focus-visible:ring-brand-tertiary"
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          }
        />
        <ErrorMessage message={error} />
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white',
            'hover:opacity-90 active:scale-[0.98] transition-all',
            'focus-visible:ring-2 focus-visible:ring-brand-tertiary focus-visible:ring-offset-2',
            'disabled:opacity-70 disabled:cursor-not-allowed'
          )}
          style={{ background: 'var(--color-brand-tertiary)' }}
        >
          {loading ? 'Starting JruJu TV…' : 'Start Watching'}
        </button>
      </form>
      <p className="text-center text-[12px] text-content-disabled mt-4">
        Need an account? Ask your parent to create one for you.
      </p>
    </>
  );
}
