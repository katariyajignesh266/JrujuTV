'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Scrolls both the window (mobile) and #main-content container (desktop app-shell)
 * to the top whenever the route (pathname) changes.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Mobile window scroll reset
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // 2. Desktop main-content container scroll reset
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname]);

  return null;
}
