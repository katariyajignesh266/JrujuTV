'use client';

import { createContext, useContext, useRef, useEffect } from 'react';

export const MainScrollContext = createContext<React.RefObject<HTMLElement | null>>({
  current: null,
});

export function useMainScroll() {
  return useContext(MainScrollContext);
}

