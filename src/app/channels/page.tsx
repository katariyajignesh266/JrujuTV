'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tv2, Plus, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { getChannels } from '@/lib/api/channels';
import { Channel } from '@/types/content';
import { cn } from '@/lib/cn';

export default function ChannelsPage() {
  const { role, initialized } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getChannels();
        if (isMounted) {
          // For public / child view, only show active channels
          const filtered = role === 'parent' ? data : data.filter((c) => c.is_active);
          setChannels(filtered);
        }
      } catch (err) {
        console.error('Failed to load channels:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (initialized) {
      load();
    }
    return () => {
      isMounted = false;
    };
  }, [initialized, role]);

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-fluid-xl font-bold text-content-primary flex items-center gap-2.5">
              <Tv2 className="text-brand-primary" size={26} /> Curated Channels
            </h1>
            <p className="text-fluid-sm text-content-secondary mt-0.5">
              Channels approved by parents with safe, kid-friendly content
            </p>
          </div>

          {role === 'parent' && (
            <Link
              href="/settings/manage-channels"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-fluid-sm font-semibold text-white shrink-0',
                'bg-brand-primary hover:bg-brand-primary/90 active:scale-95 shadow-md shadow-brand-primary/20 transition-all'
              )}
            >
              <Plus size={16} />
              <span>Manage Channels</span>
            </Link>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 pt-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center p-6 rounded-3xl bg-surface-secondary animate-pulse space-y-3">
                <div className="h-20 w-20 rounded-full bg-surface-elevated" />
                <div className="h-4 w-28 bg-surface-elevated rounded" />
                <div className="h-3 w-16 bg-surface-elevated rounded" />
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="flex items-center justify-center min-h-[50dvh]">
            <div className="max-w-md w-full text-center space-y-4">
              <EmptyState
                icon={Tv2}
                title={role === 'parent' ? 'No Channels Added Yet' : 'No Channels Available'}
                description={
                  role === 'parent'
                    ? 'Paste YouTube channel links to whitelist safe videos for your children.'
                    : 'Ask your parents to add channels from YouTube so you can watch fun and safe videos!'
                }
              />
              {role === 'parent' && (
                <div className="pt-2">
                  <Link
                    href="/settings/manage-channels"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                    <span>Add Your First Channel</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 pt-2">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} variant="public" />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
