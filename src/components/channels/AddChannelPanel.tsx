'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, Clipboard, Link2, Loader2, Plus, X } from 'lucide-react';
import { addChannel, fetchChannelDetails } from '@/lib/api/channels';
import type { Channel, ChannelPreview } from '@/types/content';
import { ChannelPreviewCard } from './ChannelPreviewCard';
import styles from './ChannelManager.module.css';

const examples = ['@SuperSimpleSongs', '@CoComelon', '@LIVComedy'];

export function AddChannelPanel({ onAdded }: { onAdded: (channel: Channel) => void }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [fetching, setFetching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [examplesOpen, setExamplesOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  useEffect(() => () => { request.current++; }, []);

  function edit(value: string) {
    request.current++;
    setInput(value);
    setPreview(null);
    setError('');
    setConfirmation('');
    setFetching(false);
  }

  async function paste() {
    const version = request.current;
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (version !== request.current) return;
      if (value) edit(value);
      else setError('Your clipboard is empty. Enter a channel link or @handle.');
    } catch {
      if (version !== request.current) return;
      setError('Paste your channel link directly into the field.');
      inputRef.current?.focus();
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || fetching || adding) return;
    const version = ++request.current;
    setFetching(true);
    setError('');
    setConfirmation('');
    setPreview(null);
    try {
      const channel = await fetchChannelDetails(input.trim());
      if (version === request.current) setPreview(channel);
    } catch (err) {
      if (version === request.current) setError(err instanceof Error ? err.message : 'Channel details could not be loaded. Try again.');
    } finally {
      if (version === request.current) setFetching(false);
    }
  }

  async function add(item: ChannelPreview) {
    if (adding || item.already_added) return;
    const version = ++request.current;
    setAdding(true);
    setError('');
    try {
      const channel = await addChannel(item);
      if (version !== request.current) return;
      onAdded({ ...channel, sync_status: channel.sync_status ?? 'pending',
        total_video_count: channel.total_video_count || item.video_count,
        name: channel.title, avatarUrl: channel.thumbnail_url });
      setInput('');
      setPreview(null);
      setConfirmation(channel.title + ' added.');
      inputRef.current?.focus();
    } catch (err) {
      if (version === request.current) setError(err instanceof Error ? err.message : 'The channel could not be added. Try again.');
    } finally {
      if (version === request.current) setAdding(false);
    }
  }

  return (
    <section className={styles.addPanel} aria-labelledby="add-channel-title">
      <div className={styles.sectionTitle}>
        <span className={styles.sectionIcon}><Plus size={20} aria-hidden="true" /></span>
        <h2 id="add-channel-title">Add a channel</h2>
      </div>
      <form onSubmit={lookup} className={styles.lookup}>
        <div className={styles.fieldHeading}>
          <label htmlFor="channel-address">YouTube link or @handle</label>
          <button type="button" className={styles.showExamples} aria-expanded={examplesOpen} aria-controls="channel-examples"
            onClick={() => setExamplesOpen(!examplesOpen)}>Examples<ChevronDown size={14} aria-hidden="true" /></button>
        </div>
        <div id="channel-examples" className={styles.examples} hidden={!examplesOpen}>
          {examples.map((handle) => <button key={handle} type="button" disabled={adding} onClick={() => {
            edit('https://www.youtube.com/' + handle);
            setExamplesOpen(false);
          }}>{handle}</button>)}
        </div>
        <div className={styles.inputWrap}>
          <Link2 size={18} aria-hidden="true" />
          <input ref={inputRef} id="channel-address" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off"
            spellCheck={false} value={input} placeholder="youtube.com/@channel" readOnly={adding}
            onChange={(event) => edit(event.target.value)} />
          {input ? <button type="button" aria-label="Clear channel link" disabled={adding} onClick={() => {
            edit(''); inputRef.current?.focus();
          }}><X size={16} aria-hidden="true" /></button> : (
            <button type="button" onClick={paste}><Clipboard size={14} aria-hidden="true" />Paste</button>
          )}
        </div>
        <button type="submit" className={preview ? styles.secondary : styles.primary} disabled={!input.trim() || fetching || adding}>
          {fetching ? <Loader2 className={styles.spinning} size={16} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {fetching ? 'Finding channel…' : 'Preview channel'}
        </button>
      </form>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {confirmation && <p className={styles.success} role="status"><CheckCircle2 size={16} aria-hidden="true" />{confirmation}</p>}
      {preview && <><span role="status" className="sr-only">Preview ready for {preview.title}.</span>
        <ChannelPreviewCard preview={preview} onAdd={add} isAdding={adding} /></>}
    </section>
  );
}
