import type { SupabaseClient } from '@supabase/supabase-js'

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const reply = (body: object, status = 200) => Response.json(body, {status})

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
  return reply({coverage:'unavailable',tracking_setup_required:true,has_watch_history:Number(watch?.seconds_watched ?? 0)>0,
    visits:[],website:0,playback:0})
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
      }
      return reply(data)
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
