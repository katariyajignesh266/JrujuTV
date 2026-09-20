'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Scrolls the window to the top whenever the route (pathname) changes.
 * Next.js App Router does not always reset scroll on client-side navigation,
 * so this component ensures the page starts at the top.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

