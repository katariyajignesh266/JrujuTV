'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const { isDark, toggleTheme, mounted } = useTheme();

  // Consistent render before mount to prevent SSR hydration mismatch
  const activeDark = mounted ? isDark : false;

  return (
    <IconButton
      icon={activeDark ? Sun : Moon}
      label={activeDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      aria-pressed={mounted ? isDark : false}
      suppressHydrationWarning
    />
  );
}
