import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { childActivity } from '../_shared/childActivity.ts'
import webpush from 'https://esm.sh/web-push@3.6.7'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info' }
const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors })
type Delivery = {event_id:string;subscription_id:string;attempt:number;endpoint:string;p256dh:string;auth:string;
  kind:string;child_name:string;occurred_at:string}
const verbs: Record<string,string> = { open: 'opened JruJu TV', start: 'started watching', close: 'closed JruJu TV' }

async function dispatch(visit: string | null) {
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@jrujutv.example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
  for (let round = 0; round < 5; round++) {
    const { data, error } = await admin.rpc('activity_claim', { p_visit: visit })
    if (error) throw new Error('claim failed')
    if (!data?.length) break
    await Promise.all(data.map(async (job: Delivery) => {
      let status = 0
      let retryAfter = 0
      try {
        const result = await webpush.sendNotification({
          endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth }
        }, JSON.stringify({ title: 'JruJu TV', body: (job.child_name || 'Your child') + ' ' + verbs[job.kind],
          icon: '/icons/icon-192x192.png', badge: '/icons/notification-badge-v1.png',
          data: { event_id: job.event_id, occurred_at: job.occurred_at, url: '/profile' }
        }), { TTL: 3600, urgency: 'high', timeout: 8000 })
        status = result.statusCode
      } catch (error) {
        const e = error as { statusCode?: number; headers?: Record<string,string> }
        status = Number(e?.statusCode) || 0
        retryAfter = Number(e?.headers?.['retry-after']) || 0
      }
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id',job.subscription_id).eq('endpoint',job.endpoint)
        return
      }
      const accepted = status >= 200 && status < 300
      const permanent = status >= 400 && status < 500 && ![408,429].includes(status)
      await admin.from('activity_deliveries').update({
        status, finished: accepted || permanent || job.attempt >= 8,
        accepted_at: accepted ? new Date().toISOString() : null,
        due: new Date(Date.now()+1000*Math.max(retryAfter, Math.min(300,2 ** job.attempt))).toISOString()
      }).eq('event_id',job.event_id).eq('subscription_id',job.subscription_id).eq('attempt',job.attempt)
    }))
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:cors})
  if (req.method !== 'POST') return reply({},405)
  const received = new Date().toISOString()
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i,'')
  if (!token) return reply({code:'AUTH_REQUIRED'},401)
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object') return reply({},400)
    if (body.kind === 'dispatch') {
      if (token !== Deno.env.get('ACTIVITY_DISPATCH_TOKEN')) return reply({},403)
      await dispatch(null)
      return reply({ok:true})
    }
    const response = await childActivity(admin, token, body, received, visit => {
      EdgeRuntime.waitUntil(dispatch(visit).catch(()=>console.error('Activity dispatch deferred')))
    })
    for (const [name,value] of Object.entries(cors)) response.headers.set(name,value)
    return response
  } catch { return reply({},503) }
})
