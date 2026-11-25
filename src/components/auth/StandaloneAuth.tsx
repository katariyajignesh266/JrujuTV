'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AuthPanel, type AuthView } from './AuthPanel';
import styles from './AuthPanel.module.css';

export function StandaloneAuth({ view }: { view: Exclude<AuthView, 'choice'> }) {
  const router = useRouter();
  const signedInHere = useRef(false);
  const { session, role, initialized } = useAuthStore();
  const alreadySignedIn = view !== 'parent-signup' && (Boolean(session) || role !== 'guest');

  useEffect(() => {
    if (initialized && alreadySignedIn && !signedInHere.current) router.replace('/profile');
  }, [initialized, alreadySignedIn, router]);

  function navigate(next: AuthView) {
    if (next === 'parent-signup') router.push('/auth/signup');
    else if (view === 'parent-signup') router.push('/auth/login');
    else router.replace(next === 'child-login' ? '/auth/login?role=child' : '/auth/login', { scroll: false });
  }

  function finishLogin() {
    signedInHere.current = true;
    router.push('/');
  }

  if (alreadySignedIn) return <p className="p-8 text-center text-content-secondary" role="status">Opening your account…</p>;
  return (
    <div className={styles.standalone}>
      <AuthPanel key={view} view={view} onNavigate={navigate} onSignedIn={finishLogin} />
    </div>
  );
}
