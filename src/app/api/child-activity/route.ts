import type { ActivityDay } from '../../../lib/activity/loadActivityDay';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const received = new Date().toISOString();
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({code:'AUTH_REQUIRED'}, {status:401});
  const body = await request.json().catch(() => null);
  if (!body || !['day','join','presence','start','interval','depart','logout'].includes(body.kind)) {
    return Response.json({code:'INVALID_ACTIVITY'}, {status:400});
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apiKey) return Response.json({code:'SERVICE_CONFIGURATION'}, {status:503});

  try {
    if (body.kind !== 'day' || !serviceKey) {
      // The Edge writer also dispatches push immediately. A gateway-confirmed missing
      // function can safely fall back to the same idempotent Postgres writer.
      const edge = await fetch(url + '/functions/v1/child-activity', {
        method:'POST', cache:'no-store', redirect:'error',
        headers:{authorization, apikey:apiKey, 'Content-Type':'application/json'},
        body:JSON.stringify(body),
      });
      const result = await edge.json();
      if (edge.status !== 404 || result?.code !== 'NOT_FOUND') {
        if (edge.ok && body.kind === 'day' && Array.isArray(result?.visits)) {
          await completeLegacyDay(result,body.child_id,body.date,authorization,url,apiKey);
        }
        const retryAfter = edge.headers.get('Retry-After');
        return Response.json(result, {status:edge.status, headers:retryAfter ? {'Retry-After':retryAfter} : {}});
      }
    }
    if (!serviceKey) return Response.json({code:'ACTIVITY_ROUTE_MISSING'}, {status:503});
    const { childActivity } = await import('../../../../supabase/functions/_shared/childActivity');
    const admin = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    return await childActivity(admin,authorization.slice(7),body,received);
  } catch {
    return Response.json({code:'ACTIVITY_SERVICE_UNAVAILABLE'},{status:503});
  }
}


const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const youtube = /^[\w-]{11}$/;
type Video = { id:string; youtube_video_id:string; title:string; thumbnail_url:string; channels:{ title:string } };

// Older Edge deployments return the event's title (or video key) without a card.
// Resolve only omissions. An explicit null is the current service's unavailable result.
async function completeLegacyDay(day: ActivityDay, child: string, date: string, token: string, url: string, apiKey: string) {
  const starts = day.visits.flatMap(visit => visit.starts).filter(start => start.card === undefined);
  const needsHistory = !day.visits.length && day.has_watch_history === true && day.history === undefined;
  if (!starts.length && !needsHistory) return;
  const db = createClient(url, apiKey, {global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const fields = 'id,youtube_video_id,title,thumbnail_url,channels!inner(title)';
  const makeCard = (v:Video, pct:number|null, resume:number) => ({
    target:v.youtube_video_id || v.id, title:v.title, thumbnail:v.thumbnail_url || (youtube.test(v.youtube_video_id) ? 'https://i.ytimg.com/vi/'+v.youtube_video_id+'/hqdefault.jpg' : ''), channel:v.channels.title, percent:pct, resume
  });
  if (needsHistory) {
    const from = new Date(date+'T00:00:00+05:30');
    const until = new Date(from.getTime()+86400000);
    day.history = [];
    for (let offset=0; ; offset+=200) {
      const {data} = await db.from('watch_sessions').select('id,last_watched_at,progress_percent,absolute_position,videos('+fields+')')
        .eq('child_id',child).gte('last_watched_at',from.toISOString()).lt('last_watched_at',until.toISOString())
        .order('last_watched_at').order('id').range(offset,offset+199).throwOnError();
      for (const row of (data ?? []) as unknown as {id:string;last_watched_at:string;videos:Video|null;progress_percent:number;absolute_position:number}[]) {
        day.history.push({id:row.id,at:row.last_watched_at,title:null,card:row.videos?makeCard(row.videos,row.progress_percent,row.absolute_position):null});
      }
      if ((data?.length ?? 0)<200) break;
    }
    day.has_watch_history ||= day.history.length>0;
    return;
  }
  const keys = [...new Set(starts.map(s=>s.title).filter((s):s is string=>!!s))];
  const matches = new Map<string,Video|null>();
  for (const column of ['id','youtube_video_id','title'] as const) {
    const candidates = keys.filter(k=>column==='id'?uuid.test(k):column==='youtube_video_id'?youtube.test(k):!matches.has(k));
    for (let i=0;i<candidates.length;i+=12) {
      const values = candidates.slice(i,i+12).map(k=>JSON.stringify(k)).join(',');
      for (let offset=0; ; offset+=200) {
        const {data} = await db.from('videos').select(fields).filter(column,'in','('+values+')')
          .order('id').range(offset,offset+199).throwOnError();
        for (const video of (data ?? []) as unknown as Video[]) {
          const key = video[column];
          matches.set(key,matches.has(key)?null:video);
        }
        if ((data?.length ?? 0)<200) break;
      }
    }
  }
  const ids = [...new Set([...matches.values()].flatMap(v=>v?[v.id]:[]))];
  const progress = new Map<string,{progress_percent:number;absolute_position:number}>();
  for (let i=0;i<ids.length;i+=60) {
    const {data} = await db.from('watch_sessions').select('video_id,progress_percent,absolute_position')
      .eq('child_id',child).in('video_id',ids.slice(i,i+60)).throwOnError();
    for (const row of data ?? []) progress.set(row.video_id,row);
  }
  for (const occurrence of starts) {
    const video = matches.get(occurrence.title ?? '');
    const row = video ? progress.get(video.id) : undefined;
    occurrence.card = video ? makeCard(video,row?.progress_percent ?? null,row?.absolute_position ?? 0) : null;
    occurrence.title = null;
  }
}
