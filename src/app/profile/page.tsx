'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/layout/PageShell';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { createClient } from '@/lib/supabase/client';
import { ChildProgressView } from '@/components/analytics/ChildProgressView';
import { formatWatchDuration } from '@/lib/formatters';
import { getChannels } from '@/lib/api/channels';
import {
  CircleUser,
  Shield,
  Settings,
  LogOut,
  ChevronRight,
  Star,
  Plus,
  Trash2,
  X,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit2,
  Check,
  Tv2,
  BarChart2,
  Clock,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  Smile,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChildRecord {
  id: string;
  parent_id: string;
  username: string;
  display_name: string;
  created_at: string;
}

// ── Avatar Gradient Palette for Children ──────────────────────────────────
const CHILD_GRADIENTS = [
  'from-amber-400 via-orange-500 to-rose-500 shadow-orange-500/25',
  'from-violet-500 via-purple-600 to-fuchsia-500 shadow-purple-500/25',
  'from-emerald-400 via-teal-500 to-cyan-500 shadow-teal-500/25',
  'from-blue-500 via-indigo-600 to-violet-600 shadow-blue-500/25',
  'from-pink-500 via-rose-500 to-red-500 shadow-pink-500/25',
];

function getChildGradient(index: number) {
  return CHILD_GRADIENTS[Math.abs(index) % CHILD_GRADIENTS.length];
}

export default function ProfilePage() {
  const { role, user, session, logout } = useAuthStore();
  const { openAuthModal } = useUIStore();
  const router = useRouter();
  const isGuest = role === 'guest';

  // Modal / panel states
  const [showManageChildren, setShowManageChildren] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);

  // Child Detail panel (parent → clicking a child card)
  const [detailChild, setDetailChild] = useState<ChildRecord | null>(null);

  // Child's own "Your Progress" panel
  const [showMyProgress, setShowMyProgress] = useState(false);

  // Children state
  const [childrenList, setChildrenList] = useState<ChildRecord[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  // Today's watch time map: { [child_id]: seconds }
  const [todayMap, setTodayMap] = useState<Record<string, number>>({});
  const [loadingToday, setLoadingToday] = useState(false);

  // Channels count state
  const [channelsCount, setChannelsCount] = useState<number | null>(null);

  // Add child form state
  const [childUsername, setChildUsername] = useState('');
  const [childDisplayName, setChildDisplayName] = useState('');
  const [childPin, setChildPin] = useState('');
  const [showPinText, setShowPinText] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [addChildLoading, setAddChildLoading] = useState(false);
  const [addChildError, setAddChildError] = useState<string | null>(null);

  // Edit child state
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Child profile info (for child account self-view)
  const [childInfo, setChildInfo] = useState<{ username?: string; display_name?: string } | null>(null);

  useEffect(() => {
    if (role === 'child' && user?.id) {
      const supabase = createClient();
      supabase
        .from('children')
        .select('username, display_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setChildInfo(data);
          }
        });
    }
  }, [role, user?.id]);

  const resolvedChildUsername =
    childInfo?.username ||
    user?.username ||
    (user?.email && user.email.includes('@')
      ? user.email.replace(/@child\.jrujutv\.internal$/i, '').split('@')[0]
      : '') ||
    '';

  const resolvedChildDisplayName =
    childInfo?.display_name ||
    (user?.name && user.name !== 'Child' ? user.name : '') ||
    resolvedChildUsername ||
    'Child';

  // ── Fetch children for parent ─────────────────────────────────────────────
  const fetchChildren = useCallback(async () => {
    if (role !== 'parent' || !session) return;
    setLoadingChildren(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setChildrenList(data as ChildRecord[]);
      }
    } catch {
      // Quiet fail if table not yet migrated
    } finally {
      setLoadingChildren(false);
    }
  }, [role, session]);

  // ── Fetch today's watch time for all children in one call ─────────────────
  const fetchTodayWatchTimes = useCallback(async () => {
    if (role !== 'parent' || !session) return;
    setLoadingToday(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-children-today-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
              ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
              : {}),
          },
          body: JSON.stringify({}),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, number> = {};
        (data.today ?? []).forEach((item: { child_id: string; seconds: number }) => {
          map[item.child_id] = item.seconds;
        });
        setTodayMap(map);
      }
    } catch {
      // Non-critical; badges just show 0m
    } finally {
      setLoadingToday(false);
    }
  }, [role, session]);

  useEffect(() => {
    if (role === 'parent') {
      fetchChildren();
      fetchTodayWatchTimes();
      getChannels().then((data) => setChannelsCount(data.length)).catch(() => {});
    }
  }, [role, fetchChildren, fetchTodayWatchTimes]);

  // ── Username availability check ───────────────────────────────────────────
  const checkUsername = async (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{1,18}[a-zA-Z0-9])?$/;
    if (!validPattern.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-username-availability`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: trimmed }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } else {
        setUsernameStatus('idle');
      }
    } catch {
      setUsernameStatus('idle');
    }
  };

  // ── Add child ─────────────────────────────────────────────────────────────
  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;

    setAddChildLoading(true);
    setAddChildError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-child-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            username: childUsername.trim().toLowerCase(),
            display_name: childDisplayName.trim(),
            password: childPin,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create child account');
      }

      await fetchChildren();
      await fetchTodayWatchTimes();
      setChildUsername('');
      setChildDisplayName('');
      setChildPin('');
      setUsernameStatus('idle');
      setShowAddChild(false);
      setShowManageChildren(true);
    } catch (err) {
      setAddChildError(err instanceof Error ? err.message : 'Error creating account');
    } finally {
      setAddChildLoading(false);
    }
  };

  // ── Delete child ──────────────────────────────────────────────────────────
  const handleDeleteChild = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove child account "${name}"?`)) {
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.from('children').delete().eq('id', id);
      if (!error) {
        setChildrenList((prev) => prev.filter((c) => c.id !== id));
        setTodayMap((prev) => { const m = { ...prev }; delete m[id]; return m; });
      }
    } catch (err) {
      console.error('Failed to remove child:', err);
    }
  };

  // ── Save edited display name ──────────────────────────────────────────────
  const handleSaveEdit = async (id: string) => {
    if (!editDisplayName.trim()) return;
    setEditLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('children')
        .update({ display_name: editDisplayName.trim() })
        .eq('id', id);

      if (!error) {
        setChildrenList((prev) =>
          prev.map((c) => (c.id === id ? { ...c, display_name: editDisplayName.trim() } : c))
        );
        setEditingChildId(null);
      }
    } catch (err) {
      console.error('Failed to update child:', err);
    } finally {
      setEditLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GUEST STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-6 text-center px-6">
          <div className="h-24 w-24 rounded-full bg-surface-secondary flex items-center justify-center">
            <CircleUser size={44} strokeWidth={1.25} className="text-content-disabled" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-fluid-xl font-bold text-content-primary mb-2">You</h1>
            <p className="text-fluid-sm text-content-secondary mb-6">
              Sign in to manage your JruJu TV experience
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-full',
                'bg-brand-primary text-white font-semibold text-fluid-sm',
                'hover:opacity-90 active:scale-95 transition-all duration-150',
                'focus-visible:ring-2 focus-visible:ring-brand-primary'
              )}
            >
              <CircleUser size={18} aria-hidden="true" />
              Sign In
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN PROFILE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <div className="max-w-lg mx-auto pb-14 space-y-5">
        {/* Avatar + Name + Summary Dashboard */}
        <div className="relative rounded-3xl bg-surface-secondary/70 backdrop-blur-xl border border-border/80 p-6 flex flex-col items-center text-center shadow-sm overflow-hidden">
          {/* Decorative ambient glow */}
          <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-brand-primary/15 via-brand-secondary/5 to-transparent pointer-events-none" />

          {/* Avatar with glowing ring & badge */}
          <div className="relative mb-3.5 mt-1">
            <div
              className={cn(
                'h-24 w-24 rounded-3xl flex items-center justify-center text-white text-3xl font-extrabold shadow-xl transition-transform duration-300 hover:scale-105',
                role === 'parent'
                  ? 'bg-gradient-to-tr from-brand-primary via-red-600 to-brand-secondary shadow-brand-primary/25 ring-4 ring-brand-primary/15'
                  : 'bg-gradient-to-tr from-brand-tertiary to-purple-600 shadow-purple-500/25 ring-4 ring-purple-500/15'
              )}
            >
              {(role === 'child' ? resolvedChildDisplayName : (user?.name || 'U')).charAt(0).toUpperCase()}
            </div>

            {/* Role indicator floating tag */}
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-xl bg-surface-elevated border-2 border-surface-secondary flex items-center justify-center shadow-md">
              {role === 'parent' ? (
                <Shield size={14} className="text-brand-primary fill-brand-primary/20" />
              ) : (
                <Star size={14} className="text-amber-500 fill-amber-500" />
              )}
            </div>
          </div>

          {/* User Name */}
          <h1 className="font-display text-fluid-xl font-bold text-content-primary tracking-tight">
            {role === 'child' ? resolvedChildDisplayName : (user?.name || 'Parent')}
          </h1>

          {/* Role Pill */}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs',
                role === 'parent'
                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/25'
                  : 'bg-brand-tertiary/15 text-brand-tertiary border border-brand-tertiary/25'
              )}
            >
              {role === 'parent' ? <Shield size={12} /> : <Star size={12} />}
              <span>{role === 'parent' ? 'Parent · Administrator' : 'Child Account'}</span>
            </span>
          </div>

          {/* Parent Summary Stats Row */}
          {role === 'parent' && (
            <div className="grid grid-cols-3 gap-2 w-full mt-6 pt-5 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  setShowManageChildren(true);
                  setShowAddChild(false);
                }}
                className="p-3 rounded-2xl bg-surface-elevated/70 border border-border/60 hover:border-brand-primary/30 active:scale-95 transition-all flex flex-col items-center"
              >
                <span className="text-fluid-lg font-extrabold text-content-primary">
                  {loadingChildren ? '…' : childrenList.length}
                </span>
                <span className="text-[11px] font-medium text-content-secondary mt-0.5">
                  Children
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/settings/manage-channels')}
                className="p-3 rounded-2xl bg-surface-elevated/70 border border-border/60 hover:border-brand-primary/30 active:scale-95 transition-all flex flex-col items-center"
              >
                <span className="text-fluid-lg font-extrabold text-content-primary">
                  {channelsCount !== null ? channelsCount : '…'}
                </span>
                <span className="text-[11px] font-medium text-content-secondary mt-0.5">
                  Channels
                </span>
              </button>

              <div className="p-3 rounded-2xl bg-surface-elevated/70 border border-border/60 flex flex-col items-center">
                <span className="text-fluid-lg font-extrabold text-content-primary">
                  {loadingToday ? '…' : formatWatchDuration(Object.values(todayMap).reduce((a, b) => a + b, 0))}
                </span>
                <span className="text-[11px] font-medium text-content-secondary mt-0.5">
                  Today Watch
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Menu list */}
        <div className="space-y-4">
          {/* ── Parent Admin Controls ──────────────────────────────────── */}
          {role === 'parent' && (
            <ProfileSection title="Admin Controls">
              <ProfileItem
                icon={Shield}
                iconBg="bg-brand-primary/10 text-brand-primary"
                label="Manage Children"
                subtitle="Profiles, screen time & watch activity"
                badge={childrenList.length > 0 ? `${childrenList.length}` : undefined}
                onClick={() => {
                  setShowManageChildren(true);
                  setShowAddChild(false);
                }}
              />
              <ProfileItem
                icon={Tv2}
                iconBg="bg-amber-500/10 text-amber-500"
                label="Manage Channels"
                subtitle="Curate and whitelist safe YouTube channels"
                badge={channelsCount !== null ? `${channelsCount}` : undefined}
                onClick={() => router.push('/settings/manage-channels')}
              />
              <ProfileItem
                icon={Plus}
                iconBg="bg-purple-500/10 text-purple-500"
                label="Add Child Account"
                subtitle="Create a safe PIN-protected profile"
                onClick={() => {
                  setShowAddChild(true);
                  setShowManageChildren(false);
                }}
              />
            </ProfileSection>
          )}

          {/* ── Child "Your Account" section ──────────────────────────── */}
          {role === 'child' && (
            <ProfileSection title="Your Account">
              <div className="p-4 space-y-2 text-fluid-sm">
                <div className="flex justify-between items-center text-content-secondary">
                  <span>Username:</span>
                  <span className="font-semibold text-content-primary">
                    @{resolvedChildUsername || '…'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-content-secondary">
                  <span>Safe Mode:</span>
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 size={14} /> Active
                  </span>
                </div>
              </div>
              {/* Your Progress entry */}
              <ProfileItem
                icon={BarChart2}
                iconBg="bg-emerald-500/10 text-emerald-500"
                label="Your Progress"
                subtitle="See what you've learned & watched"
                onClick={() => setShowMyProgress(true)}
              />
            </ProfileSection>
          )}

          <ProfileSection title="Preferences">
            <ProfileItem
              icon={Settings}
              iconBg="bg-neutral-500/10 text-content-secondary"
              label="Settings"
              subtitle="Theme, playback & security"
              onClick={() => router.push('/settings')}
            />
          </ProfileSection>

          <ProfileSection title="">
            <ProfileItem
              icon={LogOut}
              label="Log Out"
              subtitle="Sign out of your account on this device"
              danger
              onClick={logout}
            />
          </ProfileSection>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: MANAGE CHILDREN
            ══════════════════════════════════════════════════════════════════ */}
        {showManageChildren && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
              {/* Decorative top accent gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-primary via-purple-500 to-amber-500" />
              {/* Soft ambient glow in top-right */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5 pt-1">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-lg shadow-brand-primary/25 shrink-0">
                    <Shield size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-fluid-lg text-neutral-900 dark:text-white leading-tight">
                        Manage Children
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                        {childrenList.length}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Profiles, PIN security & watch analytics
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManageChildren(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {loadingChildren ? (
                <div className="py-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={24} className="animate-spin text-red-600" />
                  <span className="text-fluid-sm font-semibold">Loading child accounts…</span>
                </div>
              ) : childrenList.length === 0 ? (
                <div className="py-10 text-center space-y-3.5">
                  <div className="h-16 w-16 rounded-3xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-center justify-center text-red-600 mx-auto shadow-sm">
                    <User size={30} />
                  </div>
                  <p className="text-neutral-500 dark:text-neutral-400 text-fluid-sm max-w-xs mx-auto">
                    No child accounts yet. Add a child to set up their own safe profile with PIN protection.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageChildren(false);
                      setShowAddChild(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white text-fluid-sm font-bold shadow-lg shadow-brand-primary/25 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                    Create First Child Account
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-0.5">
                  {childrenList.map((child, idx) => (
                    <div
                      key={child.id}
                      className={cn(
                        'group relative p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800',
                        'flex flex-col gap-2.5 transition-all duration-200',
                        editingChildId !== child.id && 'cursor-pointer hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 hover:border-red-300 dark:hover:border-red-900/50 hover:shadow-md'
                      )}
                      onClick={() => {
                        if (editingChildId === child.id) return;
                        setDetailChild(child);
                        setShowManageChildren(false);
                      }}
                      role="button"
                      aria-label={`View progress for ${child.display_name}`}
                    >
                      {/* Top Row: Avatar + Info + Actions */}
                      <div className="flex items-center gap-3">
                        {/* Vibrant Kid Avatar */}
                        <div
                          className={cn(
                            'h-12 w-12 rounded-2xl bg-gradient-to-tr text-white font-extrabold flex items-center justify-center text-lg shrink-0 shadow-md relative',
                            getChildGradient(idx)
                          )}
                        >
                          {child.display_name.charAt(0).toUpperCase()}
                          <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-[9px] text-amber-500 shadow-2xs">
                            ★
                          </div>
                        </div>

                        {/* Left: Name + @username */}
                        <div className="flex-1 min-w-0">
                          {editingChildId === child.id ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editDisplayName}
                                onChange={(e) => setEditDisplayName(e.target.value)}
                                className="h-9 px-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-fluid-sm text-neutral-900 dark:text-white w-full focus:outline-none focus:ring-2 focus:ring-red-500"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(child.id)}
                                disabled={editLoading}
                                className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingChildId(null)}
                                className="h-9 w-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center shrink-0 active:scale-95"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="font-bold text-neutral-900 dark:text-white text-fluid-base truncate tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                {child.display_name}
                              </p>
                              <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                                @{child.username}
                              </p>
                            </>
                          )}
                        </div>

                        {/* Right: Edit + Delete */}
                        {editingChildId !== child.id && (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingChildId(child.id);
                                setEditDisplayName(child.display_name);
                              }}
                              className="h-8 w-8 rounded-xl flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 transition-colors shadow-2xs"
                              aria-label={`Edit ${child.display_name}`}
                              title="Edit Name"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChild(child.id, child.display_name)}
                              className="h-8 w-8 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400 hover:text-white bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-600 border border-red-200 dark:border-red-900/40 hover:border-red-600 transition-colors shadow-2xs"
                              aria-label={`Delete ${child.display_name}`}
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Watch time pill + Activity hint */}
                      {editingChildId !== child.id && (
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200/70 dark:border-neutral-800 text-[11px]">
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
                            <Clock size={11} className="text-red-600 dark:text-red-400" />
                            <span>
                              {loadingToday
                                ? '…'
                                : todayMap[child.id]
                                ? `${formatWatchDuration(todayMap[child.id])} today`
                                : '0m watched today'}
                            </span>
                          </div>
                          <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            View Activity <ChevronRight size={12} />
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Another Child CTA Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageChildren(false);
                      setShowAddChild(true);
                    }}
                    className="group relative w-full mt-4 p-4 rounded-2xl border-2 border-dashed border-red-300 dark:border-red-900/50 hover:border-red-500 bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/80 dark:hover:bg-red-950/40 transition-all flex items-center justify-between active:scale-[0.99] shadow-xs"
                  >
                    <div className="flex items-center gap-3.5 text-left">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary text-white flex items-center justify-center shadow-md shadow-brand-primary/25 group-hover:scale-105 group-hover:rotate-3 transition-transform">
                        <Plus size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="font-bold text-fluid-sm text-neutral-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          Add Another Child
                        </p>
                        <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                          Set up PIN code, safe filters & watch limits
                        </p>
                      </div>
                    </div>
                    <div className="h-7 w-7 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-all shadow-xs">
                      <ChevronRight size={14} />
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: ADD CHILD (Create Child Account)
            ══════════════════════════════════════════════════════════════════ */}
        {showAddChild && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
              {/* Decorative top accent gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-primary via-purple-500 to-amber-500" />
              {/* Soft ambient glow in top-right */}
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br from-brand-primary/15 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddChild(false);
                      setShowManageChildren(true);
                    }}
                    className="h-9 w-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                    aria-label="Back to Manage Children"
                    title="Back to children list"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h3 className="font-display font-bold text-fluid-lg text-neutral-900 dark:text-white leading-tight">
                      Create Child Account
                    </h3>
                    <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Safe profile with 4-digit PIN security
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddChild(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Live Kid Profile Avatar Preview */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800 mb-4 shadow-2xs">
                <div className="relative">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white font-black text-xl flex items-center justify-center shadow-md shadow-orange-500/25 ring-2 ring-white/20 transition-all duration-300">
                    {childDisplayName.trim() ? childDisplayName.trim().charAt(0).toUpperCase() : '★'}
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-800 flex items-center justify-center text-[8px] text-white font-bold">
                    ✓
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-fluid-sm text-neutral-900 dark:text-white truncate leading-tight">
                    {childDisplayName.trim() || 'Child Name'}
                  </p>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-mono truncate mt-0.5">
                    @{childUsername.trim() || 'username'}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 px-2.5 py-1 rounded-full shrink-0">
                  Profile Preview
                </span>
              </div>

              <form onSubmit={handleAddChild} className="space-y-3.5">
                {/* Child Display Name */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200 block" htmlFor="new-child-name">
                    Child Display Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500">
                      <Smile size={14} className="text-amber-500" />
                    </div>
                    <input
                      id="new-child-name"
                      type="text"
                      required
                      value={childDisplayName}
                      onChange={(e) => setChildDisplayName(e.target.value)}
                      placeholder="e.g. Maya, Aarav, Jruu"
                      className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-fluid-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all shadow-2xs font-medium"
                    />
                  </div>
                </div>

                {/* Unique Username */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200 block" htmlFor="new-child-username">
                      Unique Username
                    </label>
                    {/* Live status badge */}
                    {usernameStatus === 'available' && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={12} /> Available
                      </span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                        <AlertCircle size={12} /> Already taken
                      </span>
                    )}
                    {usernameStatus === 'invalid' && (
                      <span className="text-[11px] font-medium text-red-500">
                        3-20 letters & numbers
                      </span>
                    )}
                    {usernameStatus === 'checking' && (
                      <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin text-red-600" /> Checking…
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-mono text-xs font-bold text-red-600 dark:text-red-400">
                      @
                    </div>
                    <input
                      id="new-child-username"
                      type="text"
                      required
                      value={childUsername}
                      onChange={(e) => {
                        setChildUsername(e.target.value);
                        checkUsername(e.target.value);
                      }}
                      placeholder="e.g. maya-star"
                      className={cn(
                        'w-full h-12 pl-12 pr-10 rounded-2xl bg-white dark:bg-neutral-900 border text-fluid-sm text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-4 transition-all shadow-2xs font-medium',
                        usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'border-red-500 focus:ring-red-500/20'
                          : usernameStatus === 'available'
                          ? 'border-emerald-500 focus:ring-emerald-500/20'
                          : 'border-neutral-300 dark:border-neutral-700 focus:border-red-500 focus:ring-red-500/10'
                      )}
                    />
                  </div>
                </div>

                {/* Password / 4-Digit PIN */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200 block" htmlFor="new-child-pin">
                      Child 4-Digit PIN / Password
                    </label>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      For child login
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                      <Lock size={13} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <input
                      id="new-child-pin"
                      type={showPinText ? 'text' : 'password'}
                      required
                      value={childPin}
                      onChange={(e) => setChildPin(e.target.value)}
                      placeholder="••••"
                      className="w-full h-12 pl-12 pr-11 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-fluid-sm text-neutral-900 dark:text-white tracking-widest font-mono focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all shadow-2xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinText((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors"
                      aria-label={showPinText ? 'Hide PIN' : 'Show PIN'}
                      title={showPinText ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showPinText ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {addChildError && (
                  <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-fluid-sm text-center">
                    {addChildError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={addChildLoading || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                  className={cn(
                    'w-full h-12 rounded-2xl font-bold text-fluid-sm text-white mt-2',
                    'bg-gradient-to-r from-brand-primary via-red-600 to-brand-secondary shadow-lg shadow-brand-primary/30',
                    'hover:shadow-brand-primary/50 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60 disabled:transform-none flex items-center justify-center gap-2'
                  )}
                >
                  {addChildLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Creating safe account…
                    </span>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Create Child Account
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: CHILD DETAIL PANEL (parent views a child's progress)
            Opens on card tap in Manage Children. Uses the shared ChildProgressView.
            ══════════════════════════════════════════════════════════════════ */}
        {detailChild && session && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div
              className={cn(
                'relative w-full sm:max-w-md bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 shadow-2xl',
                'rounded-t-3xl sm:rounded-3xl',
                'max-h-[92dvh] flex flex-col overflow-hidden',
                'animate-in slide-in-from-bottom sm:zoom-in-95 duration-200'
              )}
            >
              {/* Decorative top accent gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-primary via-purple-500 to-amber-500" />

              {/* Panel header */}
              <div className="flex items-center gap-3 p-5 pt-6 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDetailChild(null);
                    setShowManageChildren(true);
                  }}
                  className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  aria-label="Back to Manage Children"
                >
                  <ArrowLeft size={18} />
                </button>
                {/* Child mini avatar */}
                <div
                  className={cn(
                    'h-10 w-10 rounded-xl bg-gradient-to-tr text-white font-extrabold flex items-center justify-center text-base shrink-0 shadow-sm',
                    getChildGradient(childrenList.findIndex((c) => c.id === detailChild.id))
                  )}
                >
                  {detailChild.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-neutral-900 dark:text-white text-fluid-base truncate leading-tight">
                    {detailChild.display_name}
                  </p>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-mono">@{detailChild.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailChild(null)}
                  className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-5">
                <ChildProgressView
                  childId={detailChild.id}
                  viewerRole="parent"
                  accessToken={session.access_token}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: CHILD'S OWN "YOUR PROGRESS" VIEW
            Uses the SAME ChildProgressView component, scoped to the logged-in
            child's own data — no parent-only actions.
            ══════════════════════════════════════════════════════════════════ */}
        {showMyProgress && session && role === 'child' && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div
              className={cn(
                'relative w-full sm:max-w-md bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 shadow-2xl',
                'rounded-t-3xl sm:rounded-3xl',
                'max-h-[92dvh] flex flex-col overflow-hidden',
                'animate-in slide-in-from-bottom sm:zoom-in-95 duration-200'
              )}
            >
              {/* Decorative top accent gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

              {/* Panel header */}
              <div className="flex items-center gap-3 p-5 pt-6 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <BarChart2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-neutral-900 dark:text-white text-fluid-base leading-tight">Your Progress</p>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-mono truncate">@{resolvedChildUsername || '…'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMyProgress(false)}
                  className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Close Your Progress"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-5">
                <ChildProgressView
                  childId={user!.id}
                  viewerRole="child"
                  accessToken={session.access_token}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-surface-secondary/75 backdrop-blur-xl border border-border/80 overflow-hidden shadow-xs">
      {title && (
        <p className="px-5 pt-4 pb-1 text-[11px] font-bold text-content-disabled uppercase tracking-wider">
          {title}
        </p>
      )}
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function ProfileItem({
  icon: Icon,
  iconBg = 'bg-surface-elevated text-content-secondary',
  label,
  subtitle,
  badge,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  iconBg?: string;
  label: string;
  subtitle?: string;
  badge?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3.5 px-4 sm:px-5 py-3.5 min-h-[58px]',
        'text-left transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary group',
        danger
          ? 'text-red-500 hover:bg-red-500/10'
          : 'text-content-primary hover:bg-surface-elevated/70'
      )}
    >
      <div
        className={cn(
          'h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border border-border/60 shadow-xs transition-transform duration-200 group-hover:scale-105',
          danger ? 'bg-red-500/10 text-red-500 border-red-500/20' : iconBg
        )}
      >
        <Icon size={19} strokeWidth={1.85} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-fluid-sm font-semibold truncate leading-snug">{label}</p>
        {subtitle && (
          <p className="text-[11.5px] text-content-secondary truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {badge && (
        <span className="text-[11px] font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-2.5 py-0.5 rounded-full shadow-xs">
          {badge}
        </span>
      )}
      {!badge && !danger && (
        <ChevronRight
          size={17}
          className="text-content-disabled group-hover:text-content-primary group-hover:translate-x-0.5 transition-all shrink-0"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
