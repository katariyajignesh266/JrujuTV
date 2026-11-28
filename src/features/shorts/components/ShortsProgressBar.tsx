import styles from './Shorts.module.css';

export function ShortsProgressBar({ progressPercent }: { progressPercent: number }) {
  return (
    <div className={styles.progress} role="progressbar" aria-label="Video progress"
      aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ transform: `scaleX(${progressPercent / 100})` }} />
    </div>
  );
}
