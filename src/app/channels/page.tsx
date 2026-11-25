'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Flame, RefreshCw, Search, SlidersHorizontal, Tv2, X } from 'lucide-react';
import { ChannelLibraryCard } from '@/components/channels/ChannelLibraryCard';
import styles from '@/components/channels/ChannelLibrary.module.css';
import { PageShell } from '@/components/layout/PageShell';
import { getChannels } from '@/lib/api/channels';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/auth';
import type { Channel } from '@/types/content';

const sorts = [
  { key: 'all', label: 'All', icon: null },
  { key: 'popular', label: 'Popular', icon: Flame },
  { key: 'videos', label: 'Most videos', icon: Clapperboard },
] as const;

type Sort = typeof sorts[number]['key'];
type Catalog = { status: 'loading' | 'error' } | { status: 'ready'; channels: Channel[] };

export default function ChannelsPage() {
  const { initialized, role, user } = useAuthStore();
  return (
    <PageShell className="md:w-auto">
      <ChannelLibrary key={`${role}/${user?.id ?? ''}`} initialized={initialized} role={role} />
    </PageShell>
  );
}

function ChannelLibrary({ initialized, role }: { initialized: boolean; role: Role }) {
  const [catalog, setCatalog] = useState<Catalog>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialized) return;
    let current = true;
    getChannels().then((data) => {
      if (current) {
        const channels = role === 'parent' ? data : data.filter((channel) => channel.is_active);
        setCatalog({ status: 'ready', channels });
      }
    }).catch(() => {
      if (current) setCatalog({ status: 'error' });
    });
    return () => { current = false; };
  }, [initialized, role, attempt]);

  const matches = useMemo(() => {
    if (catalog.status !== 'ready') return [];
    const text = query.trim().toLowerCase();
    const found = catalog.channels.filter((channel) => channel.title.toLowerCase().includes(text));
    if (sort === 'all') return found;
    const metric = sort === 'popular' ? 'subscriber_count' : 'video_count';
    return found.sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  }, [catalog, query, sort]);

  function clearSearch() {
    setQuery('');
    searchRef.current?.focus();
  }

  function retry() {
    setCatalog({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  const count = catalog.status === 'ready' ? catalog.channels.length : undefined;
  const loading = catalog.status === 'loading';

  return (
    <div className={styles.library}>
      <header className={styles.hero}>
        <div className={styles.heroArt}>
          <Image src="/channel-library.webp" alt="" fill priority
            sizes="(min-width: 1000px) 450px, (min-width: 600px) 48vw, 56vw" />
        </div>
        <div className={styles.heroCopy}>
          <h1>Curated <em>channels</em></h1>
          <p>Handpicked by parents.</p>
          {role === 'parent' && initialized && (
            <Link href="/settings/manage-channels" className={styles.manage}>
              <SlidersHorizontal size={16} aria-hidden="true" />Manage channels
            </Link>
          )}
        </div>
      </header>

      {(loading || (count !== undefined && count > 0)) && (
        <div className={styles.tools}>
          <div role="search" aria-label="Channel library" className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input ref={searchRef} type="search" aria-label="Search channels" placeholder="Search channels"
              value={query} disabled={loading} onChange={(e) => setQuery(e.target.value)} />
            {query && <button type="button" aria-label="Clear search" onClick={clearSearch}><X size={16} aria-hidden="true" /></button>}
          </div>
          <div role="group" aria-label="Sort channels" className={styles.sorts}>
            {sorts.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" disabled={loading} aria-pressed={sort === key}
                onClick={() => setSort(key)}>
                {Icon && <Icon size={15} aria-hidden="true" />}
                {label}
                {key === 'all' && count !== undefined && <span className={styles.count}>{count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="sr-only" role="status">
        {loading && 'Loading channels'}
        {catalog.status === 'error' && 'Channels couldn’t load. Try again.'}
        {catalog.status === 'ready' && `${matches.length} ${matches.length === 1 ? 'channel' : 'channels'} found`}
      </p>
      {loading && <LoadingCards />}
      {catalog.status === 'error' && (
        <section className={styles.state} aria-label="Channel loading error">
          <Tv2 size={27} aria-hidden="true" />
          <h2>Channels couldn’t load</h2>
          <button type="button" className={styles.stateAction} onClick={retry}><RefreshCw size={15} aria-hidden="true" />Try again</button>
        </section>
      )}
      {count === 0 && (
        <section className={styles.state}>
          <Tv2 size={27} aria-hidden="true" />
          <h2>No channels yet</h2>
          <p>{role === 'parent' ? 'Add your first YouTube channel in Manage channels.' : 'Channels will appear here when a parent adds them.'}</p>
        </section>
      )}
      {catalog.status === 'ready' && catalog.channels.length > 0 && matches.length === 0 && (
        <section className={styles.state}>
          <Search size={26} aria-hidden="true" />
          <h2>No matching channels</h2>
          <p>We couldn’t find a channel named “{query.trim()}”.</p>
          <button type="button" className={styles.stateAction} onClick={clearSearch}>Clear search</button>
        </section>
      )}
      {matches.length > 0 && (
        <ul role="list" aria-label="Channel directory" className={styles.grid}>
          {matches.map((channel) => <li key={channel.id}><ChannelLibraryCard channel={channel} /></li>)}
        </ul>
      )}
    </div>
  );
}

function LoadingCards() {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={styles.skeleton}>
          <div /><span /><span />
        </div>
      ))}
    </div>
  );
}
