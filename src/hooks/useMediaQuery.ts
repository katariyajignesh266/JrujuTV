// src/hooks/useMediaQuery.ts
'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 768px)');
}

