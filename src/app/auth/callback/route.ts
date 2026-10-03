import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

function getTargetOrigin(request: Request, defaultOrigin: string): string {
  // If in local development, use local origin
  if (process.env.NODE_ENV === 'development') {
    return defaultOrigin;
  }

  // 1. Check standard reverse proxy headers (Render, Vercel, Cloudflare, etc.)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 2. Check Host header if it's not internal localhost
  const host = request.headers.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('0.0.0.0')) {
    return `${forwardedProto}://${host}`;
  }

  // 3. Optional environment variable override
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  // 4. Fallback for Render port 10000 or internal container host
  if (
    defaultOrigin.includes(':10000') ||
    defaultOrigin.includes('localhost') ||
    defaultOrigin.includes('127.0.0.1') ||
    defaultOrigin.includes('0.0.0.0')
  ) {
    return 'https://jrujutv.onrender.com';
  }

  return defaultOrigin;
}

async function handleProfileUpsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } },
  fullName: string
) {
  const name =
    fullName ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    '';
  if (name && user.email) {
    try {
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: name,
          email: user.email,
        },
        { onConflict: 'id' }
      );
    } catch {
      // Non-critical profile upsert catch
    }
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  let next = searchParams.get('next') ?? '/profile';
  const fullName = searchParams.get('full_name') ?? '';

  // Ensure next path starts with /
  if (!next.startsWith('/')) {
    next = `/${next}`;
  }

  const targetOrigin = getTargetOrigin(request, origin);
  const supabase = await createClient();

  // 1. If PKCE code is present
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.session?.user) {
      await handleProfileUpsert(supabase, data.session.user, fullName);
      return NextResponse.redirect(`${targetOrigin}${next}`);
    }
  }

  // 2. If token_hash and type are present (standard Supabase email verification links)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!error && data?.session?.user) {
      await handleProfileUpsert(supabase, data.session.user, fullName);
      return NextResponse.redirect(`${targetOrigin}${next}`);
    }
  }

  // 3. Check if session already exists
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await handleProfileUpsert(supabase, session.user, fullName);
    return NextResponse.redirect(`${targetOrigin}${next}`);
  }

  // 4. Default: Redirect directly to /profile (never show the login page after confirmation)
  return NextResponse.redirect(`${targetOrigin}/profile`);
}
