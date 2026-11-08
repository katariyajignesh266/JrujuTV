// src/app/api/shorts/unplayable/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb3J0eGJjcnFqcWJvcnFxY2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDkzMzU0NywiZXhwIjoyMTA2NTA5NTQ3fQ.KYjTQkvu6MDbYyiXLoJgiNEj8QUURGq6EmR40ilGxLg';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://liortxbcrqjqborqqchh.supabase.co';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, reason = 'client_watchdog_timeout' } = body;

    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 1. First try updating with migration 022 columns
    const updatePayload: Record<string, any> = {
      playback_status: 'unplayable',
      is_embeddable: false,
      media_status: 'skipped',
      media_error: typeof reason === 'string' ? reason.slice(0, 200) : 'playback_watchdog_failure',
      last_checked_at: new Date().toISOString(),
    };

    let { error } = await adminClient
      .from('videos')
      .update(updatePayload)
      .eq('id', videoId);

    // 2. If migration 022 columns don't exist yet, try migration 021 columns
    if (error && error.message?.includes('column')) {
      const fallback021 = {
        media_status: 'skipped',
        media_error: typeof reason === 'string' ? reason.slice(0, 200) : 'playback_watchdog_failure',
      };
      const fallbackRes = await adminClient
        .from('videos')
        .update(fallback021)
        .eq('id', videoId);
      error = fallbackRes.error;
    }

    // 3. If neither 021 nor 022 migrations have been run on remote DB yet,
    // acknowledge cleanly without crashing so client auto-skip continues smoothly
    if (error && error.message?.includes('column')) {
      console.info(
        `[api/shorts/unplayable] Note: Video ${videoId} marked unplayable, but DB columns require migration 021/022. Excluded in client session.`
      );
      return NextResponse.json({
        success: true,
        pendingMigration: true,
        videoId,
      });
    }

    if (error) {
      console.warn('[api/shorts/unplayable] Database update warning:', error.message);
      return NextResponse.json({ success: false, warning: error.message }, { status: 200 });
    }

    return NextResponse.json({ success: true, videoId });
  } catch (err: any) {
    console.warn('[api/shorts/unplayable] Handler error:', err.message);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

