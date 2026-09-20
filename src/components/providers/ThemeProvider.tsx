'use client';

import { useTheme } from '@/hooks/useTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // This hook syncs Zustand theme state → `dark` class on <html>
  useTheme();
  return <>{children}</>;
}

