'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      aria-pressed={isDark}
    />
  );
}

