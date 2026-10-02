'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [initialize]);

  return <>{children}</>;
}
