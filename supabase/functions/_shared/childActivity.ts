import type { SupabaseClient } from '@supabase/supabase-js'

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const reply = (body: object, status = 200) => Response.json(body, {status})

// Enrich only the occurrences already authorized by child_activity_day.
type Start = { id: string; at: string; title: string | null; card?: object | null }
type DayRows = { coverage?:string; tracking_setup_required?:boolean; website?:number; playback?:number; visits: { starts: Start[] }[]; has_watch_history?: boolean; history?: object[] }

async function addDayCards(admin: SupabaseClient, viewer: string, child: string, date: string, day: DayRows) {
  const starts = day.visits.flatMap(visit => visit.starts)
  if (!starts.length && day.visits.length) return
  let parent = viewer
  if (viewer === child) {
    const {data} = await admin.from('children').select('parent_id').eq('id',child).single().throwOnError()
    parent = data!.parent_id
  }
  if (!day.visits.length) {
    const from = new Date(date + 'T00:00:00+05:30')
    const until = new Date(from.getTime() + 86400000)
    day.history = []
    // Only the last watch of a video is recoverable on pre-tracking days.
    for (let offset = 0; ; offset += 200) {
      const {data} = await admin.from('watch_sessions')
        .select('id,last_watched_at,progress_percent,absolute_position,videos(id,youtube_video_id,title,thumbnail_url,channels(title,parent_id))')
        .eq('child_id', child).eq('parent_id', parent)
        .gte('last_watched_at', from.toISOString()).lt('last_watched_at', until.toISOString())
        .order('last_watched_at').order('id').range(offset, offset + 199).throwOnError()
      for (const row of data ?? []) {
        const video = row.videos as unknown as CatalogVideo | null
        day.history.push({id:row.id, at:row.last_watched_at, title:null,
          card:video?.channels ? makeCard(video, row) : null})
      }
      if ((data?.length ?? 0) < 200) break
    }
    day.has_watch_history ||= day.history.length > 0
    return
  }

  const references = new Map<string,string>()
  const videos = new Map<string,CatalogVideo>()
  const progress = new Map<string,Progress>()
  for (const ids of batches(starts.map(start => start.id))) {
    const {data} = await admin.from('child_activity_events').select('id,video').in('id', ids).throwOnError()
    for (const event of data ?? []) references.set(event.id,event.video)
  }
  const keys = [...new Set(references.values())]
  for (const column of ['id','youtube_video_id'] as const) {
    const valid = keys.filter(key => column === 'id' ? uuid.test(key) : /^[\w-]{11}$/.test(key))
    for (const ids of batches(valid)) {
      const {data} = await admin.from('videos').select('id,youtube_video_id,title,thumbnail_url,channels!inner(title,parent_id),watch_sessions(progress_percent,absolute_position)')
        .eq('channels.parent_id',parent).eq('watch_sessions.child_id',child).eq('watch_sessions.parent_id',parent).in(column,ids).throwOnError()
      for (const video of (data ?? []) as unknown as (CatalogVideo & {watch_sessions:Progress[]})[]) {
        videos.set(video[column],video)
        if (video.watch_sessions[0]) progress.set(video.id,video.watch_sessions[0])
      }
    }
  }
  // A recorded watch can reference a catalog row outside the family's own
  // channels. Use the selected child's actual session as proof of that watch.
  const unresolved = keys.filter(key => !videos.has(key))
  for (const column of ['id','youtube_video_id'] as const) {
    const valid = unresolved.filter(key => column === 'id' ? uuid.test(key) : /^[\w-]{11}$/.test(key))
    for (const ids of batches(valid)) {
      const {data} = await admin.from('watch_sessions')
        .select('progress_percent,absolute_position,videos!inner(id,youtube_video_id,title,thumbnail_url,channels!inner(title,parent_id))')
        .eq('child_id',child).eq('parent_id',parent).in('videos.'+column,ids)
        .order('last_watched_at',{ascending:false}).throwOnError()
      for (const row of data ?? []) {
        const video = row.videos as unknown as CatalogVideo
        if (!videos.has(video[column])) {
          videos.set(video[column],video)
          progress.set(video.id,row)
        }
      }
    }
  }
  for (const start of starts) {
    const video = videos.get(references.get(start.id) ?? '')
    start.title = null // Old RPCs put the raw video key here when the event lacks a title.
    start.card = video ? makeCard(video,progress.get(video.id)) : null
  }
}

type CatalogVideo = {id:string; youtube_video_id:string; title:string; thumbnail_url:string; channels:{title:string; parent_id:string}}
type Progress = {progress_percent:number; absolute_position:number}

function makeCard(video: CatalogVideo, progress?: Progress) {
  return {target:video.youtube_video_id || video.id, title:video.title, thumbnail:video.thumbnail_url || (/^[\w-]{11}$/.test(video.youtube_video_id) ? 'https://i.ytimg.com/vi/'+video.youtube_video_id+'/hqdefault.jpg' : ''),
    channel:video.channels.title, percent:progress?.progress_percent ?? null, resume:progress?.absolute_position ?? 0}
}

function* batches(ids: string[]) {
  for (let i = 0; i < ids.length; i += 60) yield ids.slice(i,i+60)
}

async function dayReply(admin: SupabaseClient, viewer: string, child: string, date: string, day: DayRows) {
  try {
    await addDayCards(admin,viewer,child,date,day)
    return reply(day)
  } catch {
    return reply({code:'WATCH_LOOKUP_FAILED'},503)
  }
}

async function legacyDay(admin: SupabaseClient, viewer: string, childId: string, date: string) {
  let link = admin.from('children').select('id').eq('id',childId)
  if (viewer !== childId) link = link.eq('parent_id',viewer)
  const {data:child,error} = await link.maybeSingle()
  if (error) return reply({code:'FAMILY_LOOKUP_FAILED'},503)
  if (!child) return reply({},403)
  let query = admin.from('child_watch_daily').select('seconds_watched').eq('child_id',childId).eq('watch_date',date)
  if (viewer !== childId) query = query.eq('parent_id',viewer)
  const {data:watch,error:watchError} = await query.maybeSingle()
  if (watchError) return reply({code:'WATCH_LOOKUP_FAILED'},503)
  return dayReply(admin,viewer,childId,date,{coverage:'unavailable',tracking_setup_required:true,has_watch_history:Number(watch?.seconds_watched ?? 0)>0,
    visits:[],website:0,playback:Number(watch?.seconds_watched ?? 0)})
}

export async function childActivity(admin: SupabaseClient, token: string, body: Record<string, any>,
  received: string, onCommitted?: (visit: string) => void) {
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return reply({},401)
    if (body.kind === 'day') {
      if ((body.timezone !== undefined && body.timezone !== 'Asia/Kolkata') || !uuid.test(body.child_id) || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return reply({},400)
      const {data,error} = await admin.rpc('child_activity_day',{p_viewer:user.id,p_child:body.child_id,p_date:body.date})
      if (error?.code === 'PGRST202') {
        // A missing RPC alone could indicate a partial migration. Verify that the visit table is also absent.
        const {error: tableError} = await admin.from('child_visits').select('id').limit(0)
        if (tableError?.code === 'PGRST205' || tableError?.code === '42P01') {
          return legacyDay(admin,user.id,body.child_id,body.date)
        }
      }
      if (error) {
        console.warn('[child-activity] day RPC', error.code)
        return reply({code:'DAY_QUERY_FAILED'},error.code === '42501' ? 403 : 503)
      }
      if (!Array.isArray(data?.visits)) return reply({code:'INVALID_DAY_RESPONSE'},503)
      if (!data.visits.length) {
        // The day RPC has already authorized this viewer. Preserve the family constraint on the legacy read.
        let query = admin.from('child_watch_daily').select('seconds_watched')
          .eq('child_id',body.child_id).eq('watch_date',body.date)
        if (user.id !== body.child_id) query = query.eq('parent_id',user.id)
        const {data: watch,error: watchError} = await query.maybeSingle()
        if (watchError) {
          console.warn('[child-activity] daily watch lookup',watchError.code)
          return reply({code:'WATCH_LOOKUP_FAILED'},503)
        }
        data.has_watch_history = Number(watch?.seconds_watched ?? 0) > 0
        if (data.has_watch_history) data.playback = Number(watch?.seconds_watched ?? 0)
      }
      return dayReply(admin,user.id,body.child_id,body.date,data)
    }
    if (user.app_metadata.role !== 'child') return reply({},403)
    const {data: child,error: lookup} = await admin.from('children').select('id').eq('id',user.id).maybeSingle()
    if (lookup) return reply({},503)
    if (!child) return reply({},403)
    if (!['join','presence','depart','logout','start','interval'].includes(body.kind) ||
      ![body.id,body.document,body.browser].every(x=>typeof x === 'string' && uuid.test(x)) ||
      !Number.isFinite(Date.parse(body.at)) || Date.parse(body.at)<Date.now()-86400000 ||
      (body.kind==='start' && (typeof body.video!=='string' || !body.video || body.video.length>100 ||
        (body.title != null && typeof body.title !== 'string'))) ||
      (body.kind==='interval' && (!uuid.test(body.start) || !Number.isFinite(Date.parse(body.began))))) return reply({},400)
    const { data, error } = await admin.rpc('activity_record',{
      p_child:user.id,p_browser:body.browser,p_doc:body.document,p_kind:body.kind,p_event:body.id,
      p_time:body.at,p_video:body.video ?? null,p_title:body.title ?? null,p_start:body.start ?? null,
      p_began:body.began ?? null,p_received:received
    })
    if (error) {
      if (error.code === 'PGRST202') {
        return Response.json({code:'ACTIVITY_SCHEMA_REQUIRED'}, {status:503,headers:{'Retry-After':'60'}})
      }
      console.warn('[child-activity] record RPC', body.kind, error.code)
      return reply({code:'ACTIVITY_WRITE_FAILED'},503)
    }
    if (data.visit && ['join','start','logout'].includes(body.kind)) onCommitted?.(data.visit)
    return reply(data)
}
