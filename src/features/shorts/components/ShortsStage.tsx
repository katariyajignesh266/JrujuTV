'use client';

import type { ReactNode } from 'react';
import { Clapperboard, LoaderCircle, Volume2, VolumeX } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShortsFeatureStore } from '../store/shortsStore';
import styles from './Shorts.module.css';

export function ShortsStage({ children, showSound = false }: { children: ReactNode; showSound?: boolean }) {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const isMuted = useShortsFeatureStore((state) => state.isMuted);
  const toggleMute = useShortsFeatureStore((state) => state.toggleMute);
  return (
    <main id="main-content" tabIndex={-1} className={styles.stage} data-expanded={sidebarOpen}>
      <div className={styles.workspace}>
        <header className={styles.masthead}>
          <h1><span className={styles.mark}><Clapperboard aria-hidden="true" /></span>Shorts</h1>
          {showSound && <button type="button" className={styles.soundButton}
            onClick={toggleMute} aria-label="Sound" aria-pressed={!isMuted}>
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            {isMuted ? 'Sound off' : 'Sound on'}
          </button>}
        </header>
        {children}
      </div>
    </main>
  );
}

export function ShortsLoading() {
  return (
    <div className={styles.loading} role="status">
      <LoaderCircle size={25} aria-hidden="true" />
      <span>Loading Shorts…</span>
    </div>
  );
}
