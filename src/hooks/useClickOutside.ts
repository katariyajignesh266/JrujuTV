// src/hooks/useClickOutside.ts
'use client';

import { useEffect, useRef, RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true
) {
  // Store handler in a ref so we don't need to re-register listeners on every render
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current) return;
      // If click is inside the ref element (includes the trigger button), ignore
      if (ref.current.contains(e.target as Node)) return;
      handlerRef.current();
    };

    // Use 'click' instead of 'mousedown' so button onClick fires first
    document.addEventListener('click', listener, true);
    document.addEventListener('touchend', listener, true);
    return () => {
      document.removeEventListener('click', listener, true);
      document.removeEventListener('touchend', listener, true);
    };
  }, [ref, enabled]);
}
