import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  let next = searchParams.get('next') ?? '/profile';

  // Ensure next path starts with /
  if (!next.startsWith('/')) {
    next = `/${next}`;
  }

  const targetOrigin = getTargetOrigin(request, origin);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data?.session?.user) {
        const user = data.session.user;
        const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
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
      return NextResponse.redirect(`${targetOrigin}${next}`);
    }
  }

  // Auth error — redirect to profile with auth_error flag
  return NextResponse.redirect(`${targetOrigin}/profile?auth_error=true`);
}
