'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Eye, EyeOff, KeyRound, Loader2,
  LockKeyhole, Mail, ShieldCheck, Smile, UserRound, X, type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { useAuthStore } from '@/store/authStore';
import styles from './AuthPanel.module.css';

export type AuthView = 'choice' | 'parent-login' | 'child-login' | 'parent-signup';
type EmailStep = 'verify' | 'confirmation';

const headings = {
  'parent-login': ['Parent login', 'We’ll email you a six-digit code to sign in.'],
  'parent-signup': ['Create a parent account', 'Set up your family’s profiles and choose their channels.'],
  'child-login': ['Child login', 'Use the sign-in details your parent gave you.'],
};

function Field({ label, icon: Icon, trailing, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  trailing?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputBox}>
        <Icon size={18} aria-hidden="true" />
        <input id={id} required {...input} />
        {trailing}
      </div>
    </div>
  );
}

function Submit({ children, busy }: { children: ReactNode; busy: boolean }) {
  return (
    <button type="submit" className={styles.primary} disabled={busy} aria-busy={busy}>
      {busy ? <>Please wait<Loader2 className={styles.spinner} size={18} aria-hidden="true" /></>
        : <>{children}<ArrowRight size={18} aria-hidden="true" /></>}
    </button>
  );
}

function FormError() {
  const error = useAuthStore((s) => s.error);
  return error ? (
    <p role="alert" className={styles.error}><AlertCircle size={17} aria-hidden="true" />{error}</p>
  ) : null;
}

function GoogleButton() {
  const { loading, signInWithGoogle } = useAuthStore();
  return (
    <>
      <div className={styles.divider}>or</div>
      <button type="button" className={styles.secondary} disabled={loading} onClick={signInWithGoogle}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>
    </>
  );
}

function RoleOption({ child, onClick }: { child?: boolean; onClick: () => void }) {
  const Icon = child ? Smile : ShieldCheck;
  return (
    <button type="button" data-child={child || undefined} className={styles.option} onClick={onClick}>
      <span className={styles.roleIcon}><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className={styles.optionText}>
        <strong>{child ? 'Child login' : 'Continue as parent'}</strong>
        <span>{child ? 'Watch with your username and PIN.' : 'Manage profiles and channels.'}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

function ChildForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const { childLogin, loading } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await childLogin(username, password);
    if (useAuthStore.getState().session) onSignedIn?.();
  }

  return (
    <>
      <form className={styles.form} onSubmit={submit}>
        <Field label="Username" icon={UserRound} name="username" autoComplete="username"
          autoCapitalize="none" spellCheck={false} placeholder="Your username"
          value={username} onChange={(e) => setUsername(e.target.value)} />
        <Field label="Password or PIN" icon={LockKeyhole} type={visible ? 'text' : 'password'}
          name="password" autoComplete="current-password" placeholder="Your password or PIN"
          value={password} onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button type="button" className={styles.reveal} aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(!visible)}>
              {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          } />
        <FormError />
        <Submit busy={loading}>Start watching</Submit>
      </form>
      <p className={styles.help}>Need a profile? Ask your parent to create one.</p>
    </>
  );
}

function EmailFollowUp({ step, email, name, changeEmail, onSignedIn }: {
  step: EmailStep; email: string; name: string; changeEmail: () => void; onSignedIn?: () => void;
}) {
  const { verifyOtp, sendOtp, sendSignupMagicLink, loading, clearError } = useAuthStore();
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(60);
  const isCode = step === 'verify';

  useEffect(() => {
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  async function verify(value: string) {
    if (value.length !== 6 || useAuthStore.getState().loading) return;
    await verifyOtp(email, value);
    if (useAuthStore.getState().session) onSignedIn?.();
  }

  function updateCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    clearError();
    if (digits.length === 6) void verify(digits);
  }

  async function resend() {
    if (isCode) await sendOtp(email, false);
    else await sendSignupMagicLink(email, name);
    if (!useAuthStore.getState().error) {
      setCode('');
      setRemaining(60);
    }
  }

  return (
    <>
      {isCode ? (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void verify(code); }}>
          <Field label="Verification code" icon={KeyRound} name="code" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000"
            value={code} onChange={(e) => updateCode(e.target.value)}
            onPaste={(e) => { e.preventDefault(); updateCode(e.clipboardData.getData('text')); }} />
          <FormError />
          <Submit busy={loading}>Verify code</Submit>
        </form>
      ) : <FormError />}
      <div className={styles.followUp}>
        <button type="button" className={styles.secondary} onClick={changeEmail}>Use a different email</button>
        {remaining > 0 ? <p className={styles.help}>Resend {isCode ? 'code' : 'link'} in {remaining}s</p> :
          <button type="button" className={styles.textButton} onClick={resend} disabled={loading}>
            Resend {isCode ? 'code' : 'confirmation email'}
          </button>}
      </div>
    </>
  );
}

interface AuthPanelProps {
  view: AuthView;
  onNavigate: (view: AuthView) => void;
  onClose?: () => void;
  onSignedIn?: () => void;
  headingId?: string;
}

export function AuthPanel({ view, onNavigate, onClose, onSignedIn, headingId }: AuthPanelProps) {
  const { sendOtp, sendSignupMagicLink, clearError, resetOtp, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailStep, setEmailStep] = useState<EmailStep | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const choice = view === 'choice';
  const signup = view === 'parent-signup';
  const child = view === 'child-login';
  const Heading = onClose ? 'h2' : 'h1';
  const StepIcon = emailStep ? Mail : child ? Smile : ShieldCheck;

  useEffect(() => {
    if (!onClose && !emailStep) return;
    const frame = requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      bodyRef.current?.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [view, emailStep, onClose]);

  function resetMessages() {
    clearError();
    resetOtp();
  }

  function navigate(next: AuthView) {
    resetMessages();
    onNavigate(next);
  }

  function goBack() {
    if (emailStep) {
      resetMessages();
      setEmailStep(null);
    } else {
      navigate(signup ? 'parent-login' : 'choice');
    }
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (signup) await sendSignupMagicLink(email, name);
    else await sendOtp(email, false);
    const result = useAuthStore.getState();
    if (!result.error && (signup ? result.emailConfirmationSent : result.otpSent)) {
      setEmailStep(signup ? 'confirmation' : 'verify');
    }
  }

  const toolbar = (
    <div className={styles.toolbar}>
      <Logo size="sm" className={styles.brand} />
      <div className={styles.controls}>
        {((onClose && !choice) || emailStep) &&
          <button type="button" className={styles.iconButton} aria-label="Go back" onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>}
        {onClose &&
          <button type="button" className={styles.iconButton} aria-label="Close dialog" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>}
      </div>
    </div>
  );

  return (
    <div className={styles.panel} data-child={child || undefined}>
      {choice ? (
        <div className={styles.cover}>
          <div className={styles.coverArt}>
            <Image src="/family-room.webp" alt="" fill sizes="(max-width: 639px) 59vw, 285px" />
          </div>
          {toolbar}
          <Heading className={styles.coverTitle} ref={headingRef} id={headingId} tabIndex={-1}>
            Who’s <em>watching?</em>
          </Heading>
        </div>
      ) : toolbar}
      <div className={styles.body} ref={bodyRef}>
        {choice ? (
          <div className={styles.options}>
            <RoleOption onClick={() => navigate('parent-login')} />
            <RoleOption child onClick={() => navigate('child-login')} />
          </div>
        ) : (
          <>
            {!onClose && !signup && !emailStep &&
              <div className={styles.switcher} role="group" aria-label="Sign-in role">
                <button type="button" aria-pressed={!child} onClick={() => navigate('parent-login')}><ShieldCheck size={16} aria-hidden="true" /> Parent</button>
                <button type="button" aria-pressed={child} onClick={() => navigate('child-login')}><Smile size={16} aria-hidden="true" /> Child</button>
              </div>}
            <div className={styles.intro}>
              <span className={styles.stepIcon}><StepIcon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
              <Heading className={styles.title} ref={headingRef} id={headingId} tabIndex={-1}>
                {emailStep === 'verify' ? 'Enter your code' : emailStep === 'confirmation' ? 'Check your email' : headings[view][0]}
              </Heading>
              <p>{emailStep ? <>
                {emailStep === 'verify' ? 'Enter the six-digit code we sent to ' : 'To activate your account, open the link we sent to '}
                <strong>{email}</strong>.
              </> : headings[view][1]}</p>
            </div>
            {emailStep ? <EmailFollowUp step={emailStep} email={email} name={name} changeEmail={goBack} onSignedIn={onSignedIn} /> :
              child ? <ChildForm onSignedIn={onSignedIn} /> : (
                <>
                  <form className={styles.form} onSubmit={submitEmail}>
                    {signup &&
                      <Field label="Full name" icon={UserRound} name="name" autoComplete="name" placeholder="Your name"
                        value={name} onChange={(e) => setName(e.target.value)} />}
                    <Field label="Email address" icon={Mail} type="email" name="email" autoComplete="email"
                      autoCapitalize="none" spellCheck={false} placeholder="parent@example.com"
                      value={email} onChange={(e) => { setEmail(e.target.value); if (error) clearError(); }} />
                    {signup && <p className={styles.hint}><Mail size={16} aria-hidden="true" />We’ll email you an activation link.</p>}
                    <FormError />
                    {signup && error?.includes('already registered') ?
                      <button type="button" className={styles.primary} onClick={() => navigate('parent-login')}>Go to login<ArrowRight size={18} aria-hidden="true" /></button>
                      : <Submit busy={loading}>{signup ? 'Create account' : 'Send login code'}</Submit>}
                  </form>
                  <GoogleButton />
                  <p className={styles.switchAction}>
                    {signup ? 'Already have an account?' : 'New to JruJu TV?'}{' '}
                    {onClose ? (
                      <button type="button" className={styles.textButton} onClick={() => navigate(signup ? 'parent-login' : 'parent-signup')}>
                        {signup ? 'Log in' : 'Sign up'}
                      </button>
                    ) : (
                      <Link className={styles.textButton} href={signup ? '/auth/login' : '/auth/signup'} onClick={resetMessages}>
                        {signup ? 'Log in' : 'Sign up'}
                      </Link>
                    )}
                  </p>
                </>
              )}
          </>
        )}
      </div>
    </div>
  );
}
