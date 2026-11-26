'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { syncChannel } from '@/lib/api/channels';
import type { Channel } from '@/types/content';

export interface ChannelImport {
  phase: 'importing' | 'retrying' | 'paused' | 'refreshing' | 'finished' | 'failed';
  synced: number;
  total: number;
  message?: string;
}

interface ImportRun {
  timer?: ReturnType<typeof setTimeout>;
}

const pollInterval = 3000;
const maxAttempts = 200;

export function useChannelImports(channels: Channel[], reload: () => Promise<void>) {
  const [progress, setProgress] = useState<Record<string, ChannelImport>>({});
  const runs = useRef(new Map<string, ImportRun>());

  useEffect(() => {
    const active = runs.current;
    return () => {
      active.forEach((run) => clearTimeout(run.timer));
      active.clear();
    };
  }, []);

  const start = useCallback((channel: Channel, previous?: ChannelImport) => {
    const id = channel.id;
    if (runs.current.has(id)) return;
    const run: ImportRun = {};
    runs.current.set(id, run);
    const incremental = channel.sync_status === 'complete';
    let synced = previous?.synced ?? channel.synced_video_count ?? 0;
    let total = previous?.total || channel.total_video_count || 0;
    let attempts = 0;

    function publish(phase: ChannelImport['phase'], message?: string) {
      const next = { phase, synced, total, message };
      setProgress((current) => ({ ...current, [id]: next }));
    }

    async function step() {
      attempts++;
      try {
        const result = await syncChannel(id, incremental);
        if (runs.current.get(id) !== run) return;
        synced = result.syncedVideoCount ?? synced;
        total = result.totalVideoCount || total;
        if (result.complete) {
          publish('finished', incremental ? 'Channel is up to date.' : 'Video import complete.');
          await reload();
          if (runs.current.get(id) === run) runs.current.delete(id);
          return;
        }
        publish('importing');
      } catch {
        if (runs.current.get(id) !== run) return;
        if (incremental) {
          publish('failed', 'Refresh failed. Use Sync to try again.');
          runs.current.delete(id);
          return;
        }
        if (attempts < maxAttempts) {
          publish('retrying');
          run.timer = setTimeout(step, pollInterval * 3);
          return;
        }
      }
      if (attempts >= maxAttempts) {
        publish('paused');
        runs.current.delete(id);
      } else {
        run.timer = setTimeout(step, pollInterval);
      }
    }

    publish(incremental ? 'refreshing' : 'importing');
    run.timer = setTimeout(step, incremental ? 0 : 500);
  }, [reload]);

  const stop = useCallback((id: string) => {
    clearTimeout(runs.current.get(id)?.timer);
    runs.current.delete(id);
    setProgress((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    const ids = new Set(channels.map((channel) => channel.id));
    for (const id of Object.keys(progress)) {
      if (!ids.has(id)) stop(id);
    }
    for (const channel of channels) {
      const phase = progress[channel.id]?.phase;
      if ((channel.sync_status === 'pending' || channel.sync_status === 'in_progress') && !phase) {
        start(channel);
      }
      // A scheduled sync or a second tab may finish a paused or running import.
      if (channel.sync_status === 'complete' && (phase === 'paused' || phase === 'importing' || phase === 'retrying')) {
        stop(channel.id);
      }
    }
  }, [channels, progress, start, stop]);

  return { progress, sync: (channel: Channel) => start(channel, progress[channel.id]), stop };
}
