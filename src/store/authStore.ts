// src/store/authStore.ts

import { create } from 'zustand';
import type { Role, User } from '@/types/auth';
import { createClient } from '@/lib/supabase/client';
import type { Session, AuthError } from '@supabase/supabase-js';

interface AuthState {
  role: Role;
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  otpSent: boolean;
  otpEmail: string | null;
  emailConfirmationSent: boolean;
  initialized: boolean;

  // Actions
  sendOtp: (email: string, shouldCreateUser: boolean, fullName?: string) => Promise<void>;
  sendSignupMagicLink: (email: string, fullName: string) => Promise<void>;
  verifyOtp: (email: string, token: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  childLogin: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  initialize: () => (() => void);
  clearError: () => void;
  resetOtp: () => void;
}

function extractRole(session: Session | null): Role {
  if (!session) return 'guest';
  const appMeta = session.user.app_metadata;
  if (appMeta?.role === 'child') return 'child';
  if (appMeta?.role === 'parent') return 'parent';
  // Default authenticated users to parent (they registered via email/Google)
  return 'parent';
}

function extractUser(session: Session | null): User | null {
  if (!session) return null;
  const { user } = session;
  const role = extractRole(session);

  if (role === 'child') {
    return {
      id: user.id,
      name: user.user_metadata?.display_name || 'Child',
      username: user.user_metadata?.username,
      role: 'child',
      parentId: user.app_metadata?.parent_id,
    };
  }

  return {
    id: user.id,
    name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    email: user.email,
    avatar: user.user_metadata?.avatar_url,
    role: 'parent',
  };
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const supabase = createClient();

  return {
    role: 'guest',
    user: null,
    session: null,
    loading: false,
    error: null,
    otpSent: false,
    otpEmail: null,
    emailConfirmationSent: false,
    initialized: false,

    clearError: () => set({ error: null }),
    resetOtp: () => set({ otpSent: false, otpEmail: null, emailConfirmationSent: false }),

    sendSignupMagicLink: async (email: string, fullName: string) => {
      set({ loading: true, error: null });
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        // Encode fullName in the redirect URL so callback can upsert the profile
        const redirectTo = `${origin}/auth/callback?next=/&full_name=${encodeURIComponent(fullName)}`;

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            data: { full_name: fullName },
            emailRedirectTo: redirectTo,
          },
        });

        if (error) throw error;

        set({ loading: false, emailConfirmationSent: true, otpEmail: email });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send confirmation email';
        set({ loading: false, error: message });
      }
    },

    sendOtp: async (email: string, shouldCreateUser: boolean, fullName?: string) => {
      set({ loading: true, error: null });
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser,
            data: fullName ? { full_name: fullName } : undefined,
          },
        });

        if (error) {
          // Handle "user not found" case for login (shouldCreateUser: false)
          if (!shouldCreateUser && (error.message.includes('Signups not allowed') || error.message.includes('User not found') || error.message.includes('otp_disabled'))) {
            set({ loading: false, error: 'No account found with this email. Please sign up first.' });
            return;
          }
          throw error;
        }

        set({ loading: false, otpSent: true, otpEmail: email });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send verification code';
        set({ loading: false, error: message });
      }
    },

    verifyOtp: async (email: string, token: string, fullName?: string) => {
      set({ loading: true, error: null });
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });

        if (error) throw error;

        const session = data.session;
        if (session) {
          // Upsert profile for parent
          const name = fullName || session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
          await supabase.from('profiles').upsert({
            id: session.user.id,
            full_name: name,
            email: session.user.email!,
          }, { onConflict: 'id' });

          set({
            session,
            role: extractRole(session),
            user: extractUser(session),
            loading: false,
            otpSent: false,
            otpEmail: null,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid verification code';
        set({ loading: false, error: message });
      }
    },

    signInWithGoogle: async () => {
      set({ loading: true, error: null });

      try {
        const isProduction =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'jrujutv.onrender.com' ||
            !window.location.hostname.includes('localhost'));

        const origin =
          isProduction && typeof window !== 'undefined' && window.location.hostname === 'jrujutv.onrender.com'
            ? 'https://jrujutv.onrender.com'
            : (typeof window !== 'undefined' ? window.location.origin : '');

        const redirectTo = `${origin}/auth/callback?next=/profile`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
          },
        });

        if (error) throw error;

        // Google OAuth redirect happens automatically.
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Google sign-in failed';

        set({
          loading: false,
          error: message,
        });
      }
    },

    childLogin: async (username: string, password: string) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/child-login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Invalid username or password');
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        if (error) throw error;

        set({
          session: data.session,
          role: extractRole(data.session),
          user: extractUser(data.session),
          loading: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid username or password';
        set({ loading: false, error: message });
      }
    },

    logout: async () => {
      set({ loading: true });
      await supabase.auth.signOut();
      set({
        role: 'guest',
        user: null,
        session: null,
        loading: false,
        error: null,
        otpSent: false,
        otpEmail: null,
        emailConfirmationSent: false,
      });
    },

    deleteAccount: async () => {
      const { session } = get();
      if (!session) throw new Error('Not authenticated');

      set({ loading: true, error: null });
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete account');
        }

        // Sign out locally — the server-side user no longer exists
        await supabase.auth.signOut();
        set({
          role: 'guest',
          user: null,
          session: null,
          loading: false,
          error: null,
          otpSent: false,
          otpEmail: null,
          emailConfirmationSent: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete account';
        set({ loading: false, error: message });
        throw err;
      }
    },

    initialize: () => {
      // Mark as loading immediately so UI doesn't flash "guest" state
      // before we finish reading the persisted session from localStorage.
      set({ loading: true });

      // 1. Read the existing session from localStorage (persisted by @supabase/ssr).
      //    This is what keeps the user "logged in" across page refreshes and
      //    dev-server restarts — the access/refresh tokens live in localStorage.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // Upsert profile for Google sign-in users on first load
          const role = extractRole(session);
          if (role === 'parent') {
            const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
            if (name) {
              supabase.from('profiles').upsert({
                id: session.user.id,
                full_name: name,
                email: session.user.email!,
              }, { onConflict: 'id' }).then(() => {});
            }
          }
        }
        set({
          session,
          role: extractRole(session),
          user: extractUser(session),
          initialized: true,
          loading: false,
        });
      });

      // 2. Subscribe to auth state changes so the store stays in sync:
      //    - SIGNED_IN: user just logged in (OTP verified, Google callback, etc.)
      //    - SIGNED_OUT: user clicked logout
      //    - TOKEN_REFRESHED: Supabase silently refreshed the access token —
      //      we must update our store so the new token is used in future requests.
      //    - USER_UPDATED: user metadata changed
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          set({
            session,
            role: extractRole(session),
            user: extractUser(session),
            initialized: true,
            loading: false,
          });
        }
      );

      // Return unsubscribe so AuthProvider can clean up on unmount
      return () => subscription.unsubscribe();
    },
  };
});
