'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw, Shield, Trash2, Tv2 } from 'lucide-react';
import { AddChannelPanel } from '@/components/channels/AddChannelPanel';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { useChannelImports } from '@/components/channels/useChannelImports';
import library from '@/components/channels/ChannelLibrary.module.css';
import styles from '@/components/channels/ChannelManager.module.css';
import { PageShell } from '@/components/layout/PageShell';
import { deleteChannel, getChannels, toggleChannelActive, updateChannelShortsSettings } from '@/lib/api/channels';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import type { Channel } from '@/types/content';

const emptyChannels: Channel[] = [];

export default function ManageChannelsPage() {
  const { initialized, role, user } = useAuthStore();
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  return (
    <PageShell className="md:w-auto">
      <div className={library.library + ' ' + styles.workspace}>
        <header className={library.hero + ' ' + styles.masthead}>
          <div className={library.heroArt}>
            <Image src="/channel-library.webp" alt="" fill priority sizes="(min-width: 1000px) 450px, (min-width: 600px) 48vw, 56vw" />
          </div>
          <div className={library.heroCopy}>
            <Link href="/settings" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Settings</Link>
            <h1>Manage <em>channels</em></h1>
            <p>Choose your family’s YouTube channels.</p>
          </div>
        </header>
        {!initialized ? <p role="status" className={styles.empty}><Loader2 size={19} className={styles.spinning} aria-hidden="true" />Loading channel controls…</p>
          : role === 'parent' ? <ChannelManager key={user?.id} />
          : <section className={library.state}>
            <Shield size={28} aria-hidden="true" /><h2>Parent access required</h2>
            <p>{role === 'guest' ? 'Sign in with your parent account to manage your family’s channels.' : 'Your parent manages the channels available to you.'}</p>
            {role === 'guest' ? <button type="button" className={library.stateAction} onClick={openAuthModal}>Sign in as a parent</button>
              : <Link href="/channels" className={library.stateAction}>Browse channels</Link>}
          </section>}
      </div>
    </PageShell>
  );
}

function ChannelManager() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [removing, setRemoving] = useState<Channel | null>(null);
  const removeTrigger = useRef<HTMLButtonElement | null>(null);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const active = useRef(false);
  const request = useRef(0);
  const loadingRef = useRef(false);

  const reload = useCallback(async () => {
    if (!active.current) return;
    const version = ++request.current;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await getChannels();
      if (active.current && version === request.current) setChannels(rows);
    } catch {
      if (active.current && version === request.current) setLoadError(true);
    } finally {
      if (active.current && version === request.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    active.current = true;
    void reload();
    return () => { active.current = false; };
  }, [reload]);

  const imports = useChannelImports(channels ?? emptyChannels, reload);

  function updateList(change: (rows: Channel[]) => Channel[]) {
    if (!active.current) return;
    setChannels((rows) => change(rows ?? []));
    // A read that started before this write may still contain the old row.
    if (loadingRef.current || channels === null || loadError) void reload();
  }

  async function toggle(channel: Channel) {
    const visible = !channel.is_active;
    await toggleChannelActive(channel.id, visible);
    updateList((rows) => rows.map((row) => row.id === channel.id ? { ...row, is_active: visible } : row));
  }

  async function updateShorts(channel: Channel, enabled: boolean, limit: number | null) {
    await updateChannelShortsSettings(channel.id, enabled, limit);
    updateList((rows) => rows.map((row) => row.id === channel.id ? { ...row, shorts_enabled: enabled, shorts_limit: limit } : row));
  }

  async function remove(channel: Channel) {
    await deleteChannel(channel.id);
    if (!active.current) return;
    imports.stop(channel.id);
    updateList((rows) => rows.filter((row) => row.id !== channel.id));
    setRemoving(null);
    requestAnimationFrame(() => listTitle.current?.focus({ preventScroll: true }));
  }

  return (
    <div className={styles.columns}>
      <AddChannelPanel onAdded={(channel) => updateList((rows) => [channel, ...rows.filter((row) => row.id !== channel.id)])} />
      <section aria-labelledby="your-channels-title" className={styles.listSection}>
        <div className={styles.listHeader}>
          <h2 id="your-channels-title" ref={listTitle} tabIndex={-1}>Your channels
            {channels !== null && <span className={styles.count}>{channels.length}</span>}
          </h2>
          <button type="button" className={styles.secondary} disabled={loading} onClick={reload}>
            <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spinning : undefined} />Reload
          </button>
        </div>
        {loadError && <p role="alert" className={styles.error}>Your channel list couldn’t be loaded. Use Reload to try again.</p>}
        {channels === null && loading && <p role="status" className={styles.empty}><Loader2 size={18} aria-hidden="true" className={styles.spinning} />Loading your channels…</p>}
        {channels?.length === 0 && !loadError && <div className={library.state}><Tv2 size={28} aria-hidden="true" />
          <h3>No channels yet</h3><p>Add your first YouTube channel to get started.</p></div>}
        {channels && channels.length > 0 && (
          <ul className={styles.channelList}>
            {channels.map((channel) => <li key={channel.id}>
              <ChannelCard channel={channel} variant="admin" progress={imports.progress[channel.id]} onToggleActive={toggle}
                onUpdateShortsSettings={updateShorts} onSync={imports.sync} onDelete={(item, trigger) => {
                  removeTrigger.current = trigger;
                  setRemoving(item);
                }} />
            </li>)}
          </ul>
        )}
      </section>
      {removing && <RemoveDialog channel={removing} onCancel={() => {
        setRemoving(null);
        requestAnimationFrame(() => removeTrigger.current?.focus({ preventScroll: true }));
      }} onRemove={remove} />}
    </div>
  );
}

function RemoveDialog({ channel, onCancel, onRemove }: {
  channel: Channel;
  onCancel: () => void;
  onRemove: (channel: Channel) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onRemove(channel);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="remove-title" aria-describedby="remove-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
      <span className={styles.sectionIcon}><Trash2 size={21} aria-hidden="true" /></span>
      <h2 id="remove-title">Remove channel?</h2>
      <p id="remove-description">This removes <strong>{channel.title}</strong> and its cached videos from your family’s library.</p>
      {error && <p role="alert" className={styles.error}>The channel could not be removed. Try again.</p>}
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onCancel} autoFocus>Cancel</button>
        <button type="button" className={styles.primary} disabled={busy} onClick={confirm}>{busy ? 'Removing…' : 'Remove channel'}</button>
      </div>
    </dialog>
  );
}
