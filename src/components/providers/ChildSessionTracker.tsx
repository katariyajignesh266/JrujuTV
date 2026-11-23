'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { activateChild, clearIdentity, leaveActivity, presence, resetSelection } from '@/lib/activity/childActivity';

export function ChildSessionTracker() {
  const { initialized, role, session } = useAuthStore();
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith('/videos/') && pathname !== '/shorts') resetSelection();
  }, [pathname]);
  useEffect(() => {
    if (!initialized) return;
    if (role !== 'child' || !session) { clearIdentity(); return; }
    const activate = () => {
      if (document.visibilityState === 'visible') void activateChild(session.user.id,session.access_token);
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        void activateChild(session.user.id,session.access_token).then(presence);
      }
      else presence();
    };
    const hide = (event: PageTransitionEvent) => {
      if (event.persisted) presence();
      else leaveActivity();
    };
    activate();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') presence();
    },15000);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',hide);
    window.addEventListener('pageshow',activate);
    window.addEventListener('online',presence);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('pagehide',hide);
      window.removeEventListener('pageshow',activate);
      window.removeEventListener('online',presence);
    };
  }, [initialized,role,session]);
  return null;
}
