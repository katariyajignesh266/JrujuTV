'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Clapperboard, EyeOff, Tv2 } from 'lucide-react';
import { formatCompactNumber } from '@/lib/formatters';
import type { Channel } from '@/types/content';
import styles from './ChannelLibrary.module.css';

export function ChannelLibraryCard({ channel }: { channel: Channel }) {
  const [failedImage, setFailedImage] = useState<string>();
  const image = channel.thumbnail_url;
  const showImage = image && image !== failedImage;
  const videos = channel.video_count;
  const subscribers = channel.subscriber_count;
  // Keep each sleeve's color attached to its channel when the directory is sorted.
  const color = Array.from(channel.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;

  return (
    <Link href={`/channels/${channel.id}`} className={styles.card} data-color={color}>
      <div className={styles.sleeve}>
        <div className={styles.logo} aria-hidden="true">
          {showImage ? (
            // Channel thumbnails can come from several YouTube image hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={64} height={64} loading="lazy" decoding="async"
              onError={() => setFailedImage(image)} />
          ) : <Tv2 size={26} strokeWidth={1.6} />}
        </div>
        {!channel.is_active && <span className={styles.hidden}><EyeOff size={13} aria-hidden="true" />Hidden</span>}
      </div>
      <div className={styles.caption}>
        <h2>{channel.title}</h2>
        {subscribers > 0 && (
          <p>{formatCompactNumber(subscribers)} {subscribers === 1 ? 'subscriber' : 'subscribers'}</p>
        )}
      </div>
      <div className={styles.cardFooter}>
        {Number.isFinite(videos) && videos >= 0 ? (
          <span><Clapperboard size={14} aria-hidden="true" />{videos.toLocaleString()} {videos === 1 ? 'video' : 'videos'}</span>
        ) : <span>View channel</span>}
        <ArrowRight size={16} aria-hidden="true" />
      </div>
    </Link>
  );
}
