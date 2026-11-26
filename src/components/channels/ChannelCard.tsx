'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, CircleCheck, Clock3, Eye, EyeOff, RefreshCw, SlidersHorizontal, Trash2, Zap } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';
import type { Channel } from '@/types/content';
import { ChannelArtwork } from './ChannelArtwork';
import { ChannelLibraryCard } from './ChannelLibraryCard';
import type { ChannelImport } from './useChannelImports';
import styles from './ChannelManager.module.css';

interface AdminProps {
  variant: 'admin';
  channel: Channel;
  progress?: ChannelImport;
  onToggleActive: (channel: Channel) => Promise<void>;
  onUpdateShortsSettings: (channel: Channel, enabled: boolean, limit: number | null) => Promise<void>;
  onSync: (channel: Channel) => void;
  onDelete: (channel: Channel, trigger: HTMLButtonElement) => void;
}

export function ChannelCard(props: AdminProps | { channel: Channel; variant?: 'public' }) {
  return props.variant === 'admin' ? <AdminChannelCard {...props} /> : <ChannelLibraryCard channel={props.channel} />;
}

const presets = [10, 25, 50, 100, null];

function AdminChannelCard({ channel, progress, onToggleActive, onUpdateShortsSettings, onSync, onDelete }: AdminProps) {
  const id = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const enabled = channel.shorts_enabled ?? true;
  const limit = channel.shorts_limit === undefined ? 50 : channel.shorts_limit;
  const customLimit = !presets.includes(limit);
  const shortsCount = channel.shorts_total_count;
  const videoCount = channel.synced_video_count ?? channel.video_count;
  const syncTime = formatRelativeTime(channel.last_synced_at);
  const VisibilityIcon = channel.is_active ? Eye : EyeOff;
  const importing = progress?.phase === 'importing' || progress?.phase === 'retrying';
  const busy = importing || progress?.phase === 'refreshing';
  const paused = progress?.phase === 'paused';

  async function save(action: () => Promise<void>, closeCustom = false) {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await action();
      if (closeCustom) setCustomOpen(false);
    } catch {
      setSaveError('Changes could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function setLimit(next: number | null) {
    void save(() => onUpdateShortsSettings(channel, enabled, next), true);
  }

  function saveCustom(event: FormEvent) {
    event.preventDefault();
    const value = Number(customValue);
    if (Number.isInteger(value) && value >= 1 && value <= 5000) setLimit(value);
  }

  return (
    <article className={styles.channelCard} aria-labelledby={id + '-title'}>
      <div className={styles.cardHead}>
        <ChannelArtwork src={channel.thumbnail_url} className={styles.artwork} />
        <div className={styles.identity}>
          <span className={styles.visibility} data-visible={channel.is_active}>
            <VisibilityIcon size={13} aria-hidden="true" />{channel.is_active ? 'Visible to children' : 'Hidden from children'}
          </span>
          <h3 id={id + '-title'}>{channel.title}</h3>
          <p className={styles.metrics}>
            {Number.isFinite(videoCount) && <span><b>{videoCount.toLocaleString()}</b> {videoCount === 1 ? 'video' : 'videos'}</span>}
            {shortsCount != null && <span><b>{shortsCount.toLocaleString()}</b> {shortsCount === 1 ? 'Short' : 'Shorts'}</span>}
          </p>
        </div>
      </div>
      <div className={styles.details}>
        {syncTime ? (
          <span><CircleCheck size={14} aria-hidden="true" /><time dateTime={channel.last_synced_at ?? undefined}>Synced {syncTime.toLowerCase()}</time></span>
        ) : (
          <span><Clock3 size={14} aria-hidden="true" />{channel.sync_status === 'complete' ? 'Synced' : 'Awaiting first sync'}</span>
        )}
        <span><Zap size={14} aria-hidden="true" />{enabled ? limit === null ? 'All Shorts' : 'Latest ' + limit.toLocaleString() + ' Shorts' : 'Shorts off'}</span>
      </div>
      <div className={styles.actions} role="group" aria-label={'Actions for ' + channel.title}>
        <button type="button" aria-expanded={settingsOpen} aria-controls={id + '-shorts'} onClick={() => setSettingsOpen(!settingsOpen)}>
          <SlidersHorizontal size={17} aria-hidden="true" />Shorts
        </button>
        <Link href={'/channels/' + channel.id} aria-label={'Open ' + channel.title}><ArrowUpRight size={18} aria-hidden="true" />Open</Link>
        <button type="button" disabled={saving} onClick={() => void save(() => onToggleActive(channel))}>
          {channel.is_active ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          {channel.is_active ? 'Hide' : 'Show'}
        </button>
        <button type="button" disabled={busy || paused} onClick={() => onSync(channel)}>
          <RefreshCw size={16} aria-hidden="true" className={busy ? styles.spinning : undefined} />Sync
        </button>
        <button type="button" disabled={saving} className={styles.remove} onClick={(event) => onDelete(channel, event.currentTarget)}>
          <Trash2 size={16} aria-hidden="true" />Remove
        </button>
      </div>
      <div id={id + '-shorts'} hidden={!settingsOpen} className={styles.tray}>
        <div className={styles.trayHeader}>
          <h4>Shorts feed</h4>
          <button type="button" role="switch" aria-label="Include Shorts in the feed" aria-checked={enabled}
            className={styles.switch} disabled={saving} onClick={() => void save(() => onUpdateShortsSettings(channel, !enabled, limit))}>
            <span aria-hidden="true" />{enabled ? 'On' : 'Off'}
          </button>
        </div>
        {enabled && (
          <fieldset className={styles.limitGroup} disabled={saving}>
            <legend>How many recent Shorts should appear?</legend>
            <div className={styles.presets}>
              {presets.map((preset) => (
                <button type="button" key={preset ?? 'all'} aria-pressed={limit === preset} onClick={() => setLimit(preset)}>
                  {preset ?? 'All'}
                </button>
              ))}
              <button type="button" aria-expanded={customOpen} aria-pressed={customLimit} onClick={() => {
                setCustomValue(limit === null ? '' : String(limit));
                setCustomOpen(!customOpen);
              }}>{customLimit ? 'Custom (' + limit + ')' : 'Custom'}</button>
            </div>
            {customOpen && (
              <form onSubmit={saveCustom} className={styles.customLimit}>
                <label htmlFor={id + '-limit'}>Custom limit (1–5,000)</label>
                <div><input id={id + '-limit'} type="number" inputMode="numeric" min={1} max={5000} step={1}
                  required value={customValue} onChange={(event) => setCustomValue(event.target.value)} />
                  <button type="submit" className={styles.secondary}><Check size={15} aria-hidden="true" />Save</button></div>
              </form>
            )}
          </fieldset>
        )}
      </div>
      {saveError && <p role="alert" className={styles.rowError}>{saveError}</p>}
      {progress && <ImportFeedback progress={progress} onResume={() => onSync(channel)} />}
    </article>
  );
}

function ImportFeedback({ progress, onResume }: { progress: ChannelImport; onResume: () => void }) {
  const { phase, synced, total } = progress;
  if (phase === 'finished' || phase === 'failed') {
    return <p role="status" className={phase === 'failed' ? styles.rowError : styles.feedback}>{progress.message}</p>;
  }
  if (phase === 'paused') {
    return <div className={styles.feedback}><span role="status">Video import paused.</span>
      <button type="button" onClick={onResume} className={styles.secondary}>Continue import</button></div>;
  }
  const refreshing = phase === 'refreshing';
  const percent = !refreshing && total > 0 && total >= synced ? Math.round(synced / total * 100) : undefined;
  const label = refreshing ? 'Checking for new videos' : phase === 'retrying' ? 'Import interrupted. Retrying…' : 'Importing videos';
  return (
    <div className={styles.progress}>
      <div className={styles.progressCaption}><strong role="status">{label}</strong>
        {percent !== undefined && <span>{percent}%</span>}</div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className={styles.track} data-indeterminate={percent === undefined}>
        <span style={percent === undefined ? undefined : { width: percent + '%' }} />
      </div>
      {!refreshing && <p>{percent !== undefined
        ? synced.toLocaleString() + ' of ' + total.toLocaleString() + ' videos imported'
        : synced > 0 ? synced.toLocaleString() + ' videos imported so far' : 'Waiting for the first batch of videos.'}</p>}
    </div>
  );
}
