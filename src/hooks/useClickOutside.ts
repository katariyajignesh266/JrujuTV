'use client';

import { useEffect, useRef, RefObject } from 'react';

/**
 * Calls handler when user clicks/taps outside of ref.
 * Uses a single pointerdown listener in bubble phase.
 * Strictly ignores hidden/inactive responsive headers.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true
) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const listener = (e: PointerEvent) => {
      if (!ref.current) return;
      // If this element or any parent is hidden (e.g. inactive responsive header), ignore!
      if (ref.current.offsetWidth === 0 && ref.current.offsetHeight === 0 && !ref.current.getClientRects().length) {
        return;
      }
      if (ref.current.contains(e.target as Node)) return;
      handlerRef.current();
    };

    document.addEventListener('pointerdown', listener);

    return () => {
      document.removeEventListener('pointerdown', listener);
    };
  }, [ref, enabled]);
}
