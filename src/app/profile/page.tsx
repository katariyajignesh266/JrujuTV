'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { createClient } from '@/lib/supabase/client';
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
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChildRecord {
  id: string;
  parent_id: string;
  username: string;
  display_name: string;
  created_at: string;
}

export default function ProfilePage() {
  const { role, user, session, logout } = useAuthStore();
  const { openAuthModal } = useUIStore();
  const isGuest = role === 'guest';

  // Modal / panel states
  const [showManageChildren, setShowManageChildren] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);

  // Children state
  const [childrenList, setChildrenList] = useState<ChildRecord[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  // Add child form state
  const [childUsername, setChildUsername] = useState('');
  const [childDisplayName, setChildDisplayName] = useState('');
  const [childPin, setChildPin] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [addChildLoading, setAddChildLoading] = useState(false);
  const [addChildError, setAddChildError] = useState<string | null>(null);

  // Edit child state
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Fetch children for parent
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

  useEffect(() => {
    if (role === 'parent') {
      fetchChildren();
    }
  }, [role, fetchChildren]);

  // Check username availability
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

  // Add child submission
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

  // Delete child
  const handleDeleteChild = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove child account "${name}"?`)) {
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.from('children').delete().eq('id', id);
      if (!error) {
        setChildrenList((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove child:', err);
    }
  };

  // Save edited display name
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

  return (
    <PageShell>
      <div className="max-w-lg mx-auto pb-12">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 py-8">
          <div
            className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md"
            style={{ background: role === 'parent' ? 'var(--color-brand-primary)' : 'var(--color-brand-tertiary)' }}
            aria-hidden="true"
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="text-center">
            <h1 className="font-display text-fluid-xl font-bold text-content-primary">
              {user?.name || (role === 'child' ? user?.username : 'Parent')}
            </h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full text-[11px] font-semibold',
                role === 'parent'
                  ? 'bg-brand-primary/15 text-brand-primary'
                  : 'text-white'
              )}
              style={role === 'child' ? { background: 'var(--color-brand-tertiary)' } : {}}
            >
              {role === 'parent' ? <Shield size={12} aria-hidden="true" /> : <Star size={12} aria-hidden="true" />}
              {role === 'parent' ? 'Parent · Admin' : 'Child Account'}
            </span>
          </div>
        </div>

        {/* Menu list */}
        <div className="space-y-4">
          {/* Route Guard: Parent-only admin section */}
          {role === 'parent' && (
            <ProfileSection title="Admin Controls">
              <ProfileItem
                icon={Shield}
                label="Manage Children"
                badge={childrenList.length > 0 ? `${childrenList.length}` : undefined}
                onClick={() => {
                  setShowManageChildren(true);
                  setShowAddChild(false);
                }}
              />
              <ProfileItem
                icon={Plus}
                label="Add Child Account"
                onClick={() => {
                  setShowAddChild(true);
                  setShowManageChildren(false);
                }}
              />
            </ProfileSection>
          )}

          {/* Child account details */}
          {role === 'child' && (
            <ProfileSection title="Your Account">
              <div className="p-4 space-y-2 text-fluid-sm">
                <div className="flex justify-between items-center text-content-secondary">
                  <span>Username:</span>
                  <span className="font-semibold text-content-primary">@{user?.username}</span>
                </div>
                <div className="flex justify-between items-center text-content-secondary">
                  <span>Safe Mode:</span>
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 size={14} /> Active
                  </span>
                </div>
              </div>
            </ProfileSection>
          )}

          <ProfileSection title="Preferences">
            <ProfileItem icon={Settings} label="Settings" />
          </ProfileSection>

          <ProfileSection title="">
            <ProfileItem
              icon={LogOut}
              label="Log Out"
              danger
              onClick={logout}
            />
          </ProfileSection>
        </div>

        {/* ── MODAL: MANAGE CHILDREN ── */}
        {showManageChildren && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-surface-elevated rounded-3xl border border-border p-6 shadow-xl animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield size={20} className="text-brand-primary" />
                  <h3 className="font-display font-bold text-fluid-lg text-content-primary">
                    Manage Children
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManageChildren(false)}
                  className="text-content-secondary hover:text-content-primary rounded-full p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {loadingChildren ? (
                <div className="py-8 text-center text-content-secondary flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Loading accounts…
                </div>
              ) : childrenList.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-content-secondary text-fluid-sm">
                    No child accounts created yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageChildren(false);
                      setShowAddChild(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-fluid-sm font-semibold hover:opacity-90"
                  >
                    <Plus size={16} />
                    Add Child Now
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                  {childrenList.map((child) => (
                    <div
                      key={child.id}
                      className="p-3.5 rounded-2xl bg-surface-secondary border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        {editingChildId === child.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editDisplayName}
                              onChange={(e) => setEditDisplayName(e.target.value)}
                              className="h-8 px-2 rounded-lg bg-surface-elevated border border-border text-fluid-sm text-content-primary w-full"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(child.id)}
                              disabled={editLoading}
                              className="p-1.5 rounded-lg bg-brand-primary text-white"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChildId(null)}
                              className="p-1.5 rounded-lg bg-surface-elevated text-content-secondary"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold text-content-primary text-fluid-sm truncate">
                              {child.display_name}
                            </p>
                            <p className="text-[12px] text-content-secondary truncate">
                              @{child.username}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {editingChildId !== child.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingChildId(child.id);
                              setEditDisplayName(child.display_name);
                            }}
                            className="p-2 text-content-secondary hover:text-content-primary rounded-lg transition-colors"
                            aria-label={`Edit ${child.display_name}`}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteChild(child.id, child.display_name)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          aria-label={`Delete ${child.display_name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setShowManageChildren(false);
                      setShowAddChild(true);
                    }}
                    className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-border text-content-secondary hover:text-content-primary flex items-center justify-center gap-2 text-fluid-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Add Another Child
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODAL: ADD CHILD ── */}
        {showAddChild && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-surface-elevated rounded-3xl border border-border p-6 shadow-xl animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Plus size={20} className="text-brand-primary" />
                  <h3 className="font-display font-bold text-fluid-lg text-content-primary">
                    Create Child Account
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddChild(false)}
                  className="text-content-secondary hover:text-content-primary rounded-full p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddChild} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="new-child-name">
                    Child Display Name
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                    <input
                      id="new-child-name"
                      type="text"
                      required
                      value={childDisplayName}
                      onChange={(e) => setChildDisplayName(e.target.value)}
                      placeholder="e.g. Maya"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border text-fluid-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="new-child-username">
                    Unique Username
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
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
                        'w-full h-11 pl-10 pr-10 rounded-xl bg-surface-secondary border text-fluid-sm text-content-primary focus:outline-none focus:ring-2',
                        usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'border-red-500 focus:ring-red-500'
                          : usernameStatus === 'available'
                          ? 'border-emerald-500 focus:ring-emerald-500'
                          : 'border-border focus:ring-brand-primary'
                      )}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-content-disabled" />}
                      {usernameStatus === 'available' && <CheckCircle2 size={16} className="text-emerald-500" />}
                      {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                        <AlertCircle size={16} className="text-red-500" />
                      )}
                    </div>
                  </div>
                  {usernameStatus === 'taken' && (
                    <p className="text-[12px] text-red-500 font-medium">This username is already taken</p>
                  )}
                  {usernameStatus === 'invalid' && (
                    <p className="text-[12px] text-red-500">3-20 letters, numbers, hyphens</p>
                  )}
                  {usernameStatus === 'available' && (
                    <p className="text-[12px] text-emerald-500 font-medium">Username is available</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-fluid-sm font-medium text-content-primary block" htmlFor="new-child-pin">
                    Password / 4-Digit PIN
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-disabled" />
                    <input
                      id="new-child-pin"
                      type="password"
                      required
                      value={childPin}
                      onChange={(e) => setChildPin(e.target.value)}
                      placeholder="••••"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-secondary border border-border text-fluid-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                {addChildError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-fluid-sm text-center">
                    {addChildError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={addChildLoading || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                  className={cn(
                    'w-full h-11 rounded-xl font-semibold text-fluid-sm text-white bg-brand-primary',
                    'hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60'
                  )}
                >
                  {addChildLoading ? 'Creating account…' : 'Create Child Account'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-secondary border border-border overflow-hidden">
      {title && (
        <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-content-disabled uppercase tracking-wider">
          {title}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

function ProfileItem({
  icon: Icon,
  label,
  badge,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px]',
        'border-t border-border first:border-t-0',
        'text-left transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
          : 'text-content-primary hover:bg-surface-elevated'
      )}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      <span className="flex-1 text-fluid-sm font-medium">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold text-content-disabled border border-border px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {!badge && !danger && (
        <ChevronRight size={16} className="text-content-disabled shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
