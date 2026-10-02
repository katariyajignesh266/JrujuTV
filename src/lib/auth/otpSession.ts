// src/lib/auth/otpSession.ts
// Handles persistent state for pending OTP verifications across backgrounding, tab discards, and mobile app switches.

export interface PendingOtpSession {
  email: string;
  flow: 'modal' | 'login' | 'signup';
  signupName?: string;
  sentAt: number;     // Timestamp (ms) when OTP was requested
  expiresAt: number;  // Timestamp (ms) when OTP expires (10 minutes)
  digits?: string[];  // 6-digit array for partial entries
}

const STORAGE_KEY = 'jruju_pending_otp_session';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes (matches Supabase OTP validity)

export function savePendingOtpSession(data: {
  email: string;
  flow: 'modal' | 'login' | 'signup';
  signupName?: string;
  digits?: string[];
}): void {
  if (typeof window === 'undefined') return;
  try {
    const session: PendingOtpSession = {
      email: data.email.trim().toLowerCase(),
      flow: data.flow,
      signupName: data.signupName,
      sentAt: Date.now(),
      expiresAt: Date.now() + OTP_TTL_MS,
      digits: data.digits || ['', '', '', '', '', ''],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('[OTP Session] Failed to save session to localStorage:', err);
  }
}

export function getPendingOtpSession(): PendingOtpSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: PendingOtpSession = JSON.parse(raw);
    if (!session || !session.email || typeof session.sentAt !== 'number') {
      clearPendingOtpSession();
      return null;
    }
    // Check if expired (older than 10 minutes)
    if (Date.now() > session.expiresAt) {
      clearPendingOtpSession();
      return null;
    }
    return session;
  } catch {
    clearPendingOtpSession();
    return null;
  }
}

export function updatePendingOtpDigits(digits: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const session = getPendingOtpSession();
    if (session) {
      session.digits = digits;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  } catch {}
}

export function clearPendingOtpSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Calculates remaining countdown seconds for resend cooldown (60s).
 */
export function calculateOtpCountdown(sentAt: number, totalSeconds = 60): number {
  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, totalSeconds - elapsed);
}
