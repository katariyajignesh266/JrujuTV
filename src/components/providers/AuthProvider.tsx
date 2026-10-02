'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * AuthProvider — mounts once at the root layout.
 * Calls `initialize()` which:
 *   1. Reads the existing Supabase session from localStorage (persisted by @supabase/ssr).
 *   2. Subscribes to auth state changes (token refresh, sign-in, sign-out).
 * This ensures the user stays logged in across page refreshes and dev-server restarts,
 * as long as their session / refresh-token has not expired.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // initialize() returns the onAuthStateChange unsubscribe function
    const unsubscribe = initialize();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — initialize is stable (Zustand action ref never changes)

  return <>{children}</>;
}

