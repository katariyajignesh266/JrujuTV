'use client';

import { X, Shield, User, Lock, Mail, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/shared/Logo';
import { useClickOutside } from '@/hooks/useClickOutside';

type Step = 'choice' | 'parent-login' | 'parent-signup' | 'child-login';

export function AuthModal() {
  const { authModalOpen, closeAuthModal } = useUIStore();
  const { loginAsParent, loginAsChild } = useAuthStore();
  const [step, setStep] = useState<Step>('choice');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useClickOutside(modalRef, closeAuthModal, authModalOpen);

  const handleClose = () => {
    closeAuthModal();
    setStep('choice');
  };

  // Keyboard dismissibility (Escape key) & Focus Trap
  useEffect(() => {
    if (!authModalOpen) return;

    // Save previous active element to restore focus on close
    triggerRef.current = document.activeElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // Focus trap
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

    // Auto-focus first focusable element inside modal
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
        triggerRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authModalOpen, step]);

  if (!authModalOpen) return null;

  const handleMockLogin = (type: 'parent' | 'child') => {
    setIsLoading(true);
    setTimeout(() => {
      if (type === 'parent') loginAsParent();
      else loginAsChild('Little Viewer');
      setIsLoading(false);
      handleClose();
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={step === 'choice' ? 'Sign in to JruJu TV' : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" onClick={handleClose} />

      {/* Modal */}
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
        {/* Sticky Header with Back & Close button (always visible even on short heights) */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 pb-2 bg-surface-elevated/95 backdrop-blur-sm border-b border-border/40">
          {step !== 'choice' ? (
            <button
              type="button"
              aria-label="Go back"
              onClick={() => setStep('choice')}
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
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <Logo size="md" variant="full" />
          </div>

          {/* ── CHOICE SCREEN ──────────────────────────── */}
          {step === 'choice' && (
            <>
              <h1 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
                Welcome to JruJu TV
              </h1>
              <p className="text-fluid-sm text-content-secondary text-center mb-6">
                Choose how you&apos;d like to continue
              </p>

              <div className="space-y-3">
                {/* Parent option */}
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

                {/* Child option */}
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

          {/* ── PARENT LOGIN ─────────────────────────── */}
          {step === 'parent-login' && (
            <ParentLoginForm
              onSignupClick={() => setStep('parent-signup')}
              onSubmit={() => handleMockLogin('parent')}
              isLoading={isLoading}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          )}

          {/* ── PARENT SIGNUP ────────────────────────── */}
          {step === 'parent-signup' && (
            <ParentSignupForm
              onLoginClick={() => setStep('parent-login')}
              onSubmit={() => handleMockLogin('parent')}
              isLoading={isLoading}
            />
          )}

          {/* ── CHILD LOGIN ──────────────────────────── */}
          {step === 'child-login' && (
            <ChildLoginForm
              onSubmit={() => handleMockLogin('child')}
              isLoading={isLoading}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-forms ────────────────────────────────────────────── */

function FormInput({
  label,
  id,
  type = 'text',
  placeholder,
  icon: Icon,
  suffix,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder: string;
  icon: React.ElementType;
  suffix?: React.ReactNode;
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

function ParentLoginForm({
  onSignupClick,
  onSubmit,
  isLoading,
  showPassword,
  setShowPassword,
}: {
  onSignupClick: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Parent Login
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-5">
        Access your parental admin dashboard
      </p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <FormInput label="Email Address" id="parent-email" type="email" placeholder="parent@example.com" icon={Mail} />
        <FormInput
          label="Password"
          id="parent-password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          icon={Lock}
          suffix={
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              className="text-content-disabled hover:text-content-secondary w-10 h-10 -mr-2 flex items-center justify-center rounded-lg transition-colors focus-visible:ring-1 focus-visible:ring-brand-primary"
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          }
        />
        <SubmitButton label="Log In as Parent" isLoading={isLoading} />
      </form>
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
  onSubmit,
  isLoading,
}: {
  onLoginClick: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Create Parent Account
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-5">
        Set up your family&apos;s safe viewing controls
      </p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <FormInput label="Full Name" id="signup-name" placeholder="Your name" icon={User} />
        <FormInput label="Email Address" id="signup-email" type="email" placeholder="parent@example.com" icon={Mail} />
        <FormInput label="Password" id="signup-password" type="password" placeholder="At least 8 characters" icon={Lock} />
        <FormInput label="Confirm Password" id="signup-confirm" type="password" placeholder="Confirm password" icon={Lock} />
        <SubmitButton label="Create Account &amp; Continue" isLoading={isLoading} />
      </form>
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

function ChildLoginForm({
  onSubmit,
  isLoading,
  showPassword,
  setShowPassword,
}: {
  onSubmit: () => void;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <>
      <h2 className="text-fluid-xl font-display font-bold text-center text-content-primary mb-1">
        Child Login
      </h2>
      <p className="text-fluid-sm text-content-secondary text-center mb-5">
        Use the credentials your parent set up for you
      </p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <FormInput label="Username" id="child-username" placeholder="your-username" icon={User} />
        <FormInput
          label="Password / PIN"
          id="child-password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••"
          icon={Lock}
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
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white',
            'hover:opacity-90 active:scale-[0.98] transition-all',
            'focus-visible:ring-2 focus-visible:ring-brand-tertiary focus-visible:ring-offset-2',
            'disabled:opacity-70 disabled:cursor-not-allowed'
          )}
          style={{ background: 'var(--color-brand-tertiary)' }}
        >
          {isLoading ? 'Starting JruJu TV…' : 'Start Watching'}
        </button>
      </form>
      {/* Child login does NOT display a signup link per specification */}
      <p className="text-center text-[12px] text-content-disabled mt-4">
        Need an account? Ask your parent to create one for you.
      </p>
    </>
  );
}
