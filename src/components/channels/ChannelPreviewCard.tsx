'use client';

import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import type { ChannelPreview } from '@/types/content';
import { formatCompactNumber } from '@/lib/formatters';
import { ChannelArtwork } from './ChannelArtwork';
import styles from './ChannelManager.module.css';

interface ChannelPreviewCardProps {
  preview: ChannelPreview;
  onAdd: (preview: ChannelPreview) => void;
  isAdding: boolean;
}

export function ChannelPreviewCard({ preview, onAdd, isAdding }: ChannelPreviewCardProps) {
  return (
    <section className={styles.preview} aria-label="Channel preview">
      <div className={styles.previewHead}>
        <ChannelArtwork src={preview.thumbnail_url} className={styles.artwork} />
        <div>
          <h3>{preview.title}</h3>
          <p className={styles.metrics}>
            {preview.subscriber_count > 0 && <span>{formatCompactNumber(preview.subscriber_count)} subscribers</span>}
            {Number.isFinite(preview.video_count) && <span>{preview.video_count.toLocaleString()} {preview.video_count === 1 ? 'video' : 'videos'}</span>}
          </p>
        </div>
      </div>
      {preview.uploads_playlist_id && <details className={styles.playlist}>
        <summary>Uploads playlist ID</summary><code>{preview.uploads_playlist_id}</code>
      </details>}
      {preview.already_added ? (
        <p className={styles.success} role="status"><CheckCircle2 size={16} aria-hidden="true" />Already in your channels</p>
      ) : (
        <button type="button" className={styles.primary} disabled={isAdding} onClick={() => onAdd(preview)}>
          {isAdding ? <Loader2 size={16} aria-hidden="true" className={styles.spinning} /> : <Plus size={17} aria-hidden="true" />}
          {isAdding ? 'Adding channel…' : 'Add to your channels'}
        </button>
      )}
    </section>
  );
}
