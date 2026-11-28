'use client';

import Link from 'next/link';
import { Library, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import styles from './Shorts.module.css';

interface ShortsEmptyStateProps {
  loadFailed: boolean;
  onRetry: () => void;
  onReplay: () => void;
}

export function ShortsEmptyState({ loadFailed, onRetry, onReplay }: ShortsEmptyStateProps) {
  const isParent = useAuthStore((state) => state.role === 'parent');
  const title = loadFailed ? 'Shorts couldn’t load' : 'No shorts to play';
  const description = loadFailed
    ? 'Check your connection and try loading the feed again.'
    : isParent
      ? 'Enable Shorts for a channel in your library, or reset watch history to replay earlier shorts.'
      : 'Check back for new shorts, or reset watch history to replay earlier ones.';

  return (
    <section className={styles.empty} aria-labelledby="shorts-state-title">
      <div className={styles.emptyArt} aria-hidden="true" />
      <div className={styles.emptyCopy}>
        <h2 id="shorts-state-title">{title}</h2>
        <p>{description}</p>
        <div className={styles.emptyActions}>
          <button type="button" className={styles.primaryButton} onClick={loadFailed ? onRetry : onReplay}>
            <RotateCcw size={16} aria-hidden="true" />{loadFailed ? 'Try again' : 'Reset history & replay'}
          </button>
          {!loadFailed && isParent && <Link href="/settings/manage-channels" className={styles.secondaryButton}>
            <Library size={16} aria-hidden="true" />Manage channels
          </Link>}
        </div>
      </div>
    </section>
  );
}
