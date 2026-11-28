import { ChevronDown, ChevronUp, Film, ListVideo } from 'lucide-react';
import { formatDuration } from '@/lib/formatters';
import type { ShortVideo } from '../types';
import styles from './Shorts.module.css';

interface ShortsQueueProps {
  videos: ShortVideo[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function ShortsQueue({ videos, activeIndex, onSelect }: ShortsQueueProps) {
  const upcoming = videos.slice(activeIndex + 1, activeIndex + 5);
  return (
    <aside className={styles.queue} aria-labelledby="shorts-up-next">
      <div className={styles.queueHead}>
        <h2 id="shorts-up-next"><ListVideo size={21} aria-hidden="true" />Up next</h2>
        <div className={styles.stepControls}>
          <button type="button" aria-label="Previous short" title="Previous short (↑)"
            disabled={activeIndex === 0} onClick={() => onSelect(activeIndex - 1)}><ChevronUp size={18} /></button>
          <button type="button" aria-label="Next short" title="Next short (↓)"
            disabled={!upcoming.length} onClick={() => onSelect(activeIndex + 1)}><ChevronDown size={18} /></button>
        </div>
      </div>
      {upcoming.length ? <ol className={styles.queueList}>
        {upcoming.map((video, offset) => {
          const thumbnail = video.poster_url || video.thumbnail_url;
          const channel = video.channel?.title || video.channelName;
          return (
            <li key={video.id || video.youtube_video_id}>
              <button type="button" className={styles.queueItem} onClick={() => onSelect(activeIndex + offset + 1)}>
                <span className={styles.queueThumb}>
                  <Film size={23} aria-hidden="true" />
                  {thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
                  )}
                  {video.duration_seconds > 0 && <span>{formatDuration(video.duration_seconds)}</span>}
                </span>
                <span className={styles.queueCopy}>
                  <strong dir="auto">{video.title || 'Untitled short'}</strong>
                  {channel && <small dir="auto">{channel}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol> : <p className={styles.queueEnd}>You’ve reached the last short in this feed.</p>}
    </aside>
  );
}
