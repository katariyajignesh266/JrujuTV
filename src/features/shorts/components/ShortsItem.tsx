'use client';

import { memo, useEffect, useRef } from 'react';
import { CircleAlert, LoaderCircle, Pause, Play, Radio, RotateCcw } from 'lucide-react';
import { formatDuration } from '@/lib/formatters';
import { useShortsFeatureStore } from '../store/shortsStore';
import type { ShortVideo } from '../types';
import { ShortsProgressBar } from './ShortsProgressBar';
import { ShortsVideoPlayer } from './ShortsVideoPlayer';
import styles from './Shorts.module.css';

interface ShortsItemProps {
  video: ShortVideo;
  index: number;
  isActive: boolean;
  isMounted: boolean;
  isV2: boolean;
  hasFrame: boolean;
  isPlaying: boolean;
  progressPercent: number;
  errorMessage: string | null;
  onAttachContainer: (index: number, el: HTMLDivElement | null) => void;
  onAttachV2Container: (index: number, el: HTMLDivElement | null) => void;
  onGestureTap: () => void;
  onTogglePlayback: () => void;
  onRetry: () => void;
}

export const ShortsItem = memo(function ShortsItem({
  video, index, isActive, isMounted, isV2, hasFrame, isPlaying, progressPercent,
  errorMessage, onAttachContainer, onAttachV2Container, onGestureTap, onTogglePlayback, onRetry,
}: ShortsItemProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const unlocked = useShortsFeatureStore((state) => state.hasUserGestureUnlocked);
  const poster = video.poster_url || video.thumbnail_url;
  const channel = video.channel?.title || video.channelName;
  const avatar = video.channel?.thumbnail_url || video.channelAvatarUrl;
  const title = video.title || 'Untitled short';
  const duration = video.duration_seconds;
  const progress = Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : 0;
  const playbackLabel = isPlaying ? 'Pause short' : 'Play short';

  useEffect(() => {
    if (isV2 || !isMounted) return;
    onAttachContainer(index, frameRef.current);
    return () => onAttachContainer(index, null);
  }, [index, isV2, isMounted, onAttachContainer]);

  return (
    <article className={styles.item} aria-label={title} inert={!isActive}>
      <div className={styles.picture}>
        {isMounted && poster && (
          <div className={styles.ambient} aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(poster)})` }} />
        )}
        <div className={styles.aperture}>
          {isMounted && (isV2 ? (
            <ShortsVideoPlayer index={index} isActive={isActive} onAttachContainer={onAttachV2Container} />
          ) : (
            <div ref={frameRef} className="shorts-player-frame" />
          ))}
          {isMounted && poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.poster} data-visible={!hasFrame} src={poster} alt="" />
          )}
        </div>
        {isActive && (errorMessage ? (
          <div className={styles.playerError} role="status">
            <CircleAlert size={26} aria-hidden="true" />
            <strong>This short couldn’t play</strong>
            <p>{errorMessage}</p>
            <button type="button" className={styles.secondaryButton} onClick={onRetry}>
              <RotateCcw size={15} aria-hidden="true" />Try again
            </button>
          </div>
        ) : (
          <>
            <button type="button" className={styles.gesture} onClick={onGestureTap}
              aria-label={unlocked ? playbackLabel : 'Play with sound'} tabIndex={-1} />
            {!hasFrame && <span className={styles.buffering} role="status">
              <LoaderCircle size={22} aria-hidden="true" /><span className="sr-only">Loading video</span>
            </span>}
          </>
        ))}
      </div>
      <footer className={styles.caption}>
        <div className={styles.captionRow}>
          <div className={styles.captionText}>
            {channel && <div className={styles.channel}>
              <span className={styles.avatar}>
                <Radio size={13} aria-hidden="true" />
                {avatar && isMounted && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
                )}
              </span>
              <span dir="auto">{channel}</span>
            </div>}
            <h2 dir="auto" title={title}>{title}</h2>
          </div>
          <button type="button" aria-label={playbackLabel} title={playbackLabel}
            className={styles.playButton} disabled={!!errorMessage} onClick={onTogglePlayback}>
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </button>
        </div>
        <div className={styles.timeline}>
          <ShortsProgressBar progressPercent={progress} />
          {duration > 0 && <span className={styles.time}>
            {formatDuration(duration * progress / 100)} <span>/</span> {formatDuration(duration)}
          </span>}
        </div>
      </footer>
    </article>
  );
});
