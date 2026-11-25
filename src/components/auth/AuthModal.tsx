'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { AuthPanel, type AuthView } from './AuthPanel';
import styles from './AuthPanel.module.css';

export function AuthModal() {
  const open = useUIStore((s) => s.authModalOpen);
  return open ? <AuthDialog /> : null;
}

function AuthDialog() {
  const [view, setView] = useState<AuthView>('choice');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const closeAuthModal = useUIStore((s) => s.closeAuthModal);
  const { session, clearError, resetOtp } = useAuthStore();

  const close = useCallback(() => {
    clearError();
    resetOtp();
    closeAuthModal();
  }, [clearError, resetOtp, closeAuthModal]);

  useEffect(() => {
    if (session) close();
  }, [session, close]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();

    // Mobile browsers can shrink only the visual viewport when the keyboard opens.
    const viewport = window.visualViewport;
    function fitViewport() {
      if (!dialog || !viewport) return;
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      dialog.style.setProperty('--visible-height', `${viewport.height}px`);
      dialog.style.setProperty('--keyboard-inset', `${covered}px`);
    }
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    return () => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      document.body.style.overflow = previousOverflow;
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={headingId}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <AuthPanel key={view} view={view} onNavigate={setView} onClose={close} headingId={headingId} />
    </dialog>
  );
}
