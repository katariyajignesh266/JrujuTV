import assert from 'node:assert/strict';
import { loadActivityDay } from '../src/lib/activity/loadActivityDay.ts';
import { childActivity } from '../supabase/functions/_shared/childActivity.ts';
import { checkActivityRoute } from './check-activity-route.mjs';
import { POST } from '../src/app/api/child-activity/route.ts';

const calls = [];
let status = 404;
let payload = {code:'NOT_FOUND',message:'Requested function was not found'};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  calls.push({method:options.method,path:new URL(url,'http://localhost:3000').pathname,body:JSON.parse(options.body)});
  return Response.json(payload,{status});
};
const base = 'https://fixture.invalid';
process.env.NEXT_PUBLIC_SUPABASE_URL = base;
const load = (date) => loadActivityDay('selected-child',date,'fixture',new AbortController().signal);
try {
  await assert.rejects(checkActivityRoute(base), /HTTP 404/);
  await assert.rejects(load('2026-11-23'), {status:404});
  status = 401;
  payload = {code:'AUTH_REQUIRED'};
  await checkActivityRoute(base);
  status = 200;
  payload = {coverage:'full',website:120,playback:30,visits:[{
    id:'visit',opened:'2026-11-22T18:30:00Z',closed:'2026-11-22T18:32:00Z',seconds:120,inferred:true,
    starts:[{id:'start',title:'Fixture title',at:'2026-11-22T18:31:00Z'}]
  }]};
  assert.deepEqual(await load('2026-11-23'),payload);
  assert.deepEqual(calls[1],calls[3]);
  assert.deepEqual(calls[3],{method:'POST',path:'/api/child-activity',
    body:{kind:'day',child_id:'selected-child',date:'2026-11-23',timezone:'Asia/Kolkata'}});
  payload = {coverage:'full',website:0,playback:0,visits:[],has_watch_history:true};
  assert.equal((await load('2026-11-22')).has_watch_history,true);
  assert.equal(calls.at(-1).body.date,'2026-11-22');
  status = 503;
  payload = {code:'SERVICE_CONFIGURATION'};
  await assert.rejects(load('2026-11-23'), {reason:'SERVICE_CONFIGURATION',status:503});
  status = 200;
  payload = {...payload,visits:[{}]};
  await assert.rejects(load('2026-11-22'), {reason:'invalid_response'});
  status = 403;
  await assert.rejects(load('2026-11-22'),{status:403});
  console.log('PASS: missing deployed route, fresh successful retry, date/zone, timeline, historical gap, invalid response and forbidden read.');
} finally {
  globalThis.fetch = originalFetch;
}

// Exercise the shared server path used by localhost before migration 023 is installed.
const child = '00000000-0000-4000-8000-000000000001';
let linked = true;
const admin = {
  auth:{getUser:async()=>({data:{user:{id:'fixture-parent'}}})},
  rpc:async()=>({error:{code:'PGRST202'}}),
  from(table) {
    if (table === 'watch_sessions') {
      const filters = {};
      return {select(){return this;}, eq(k,v){filters[k]=v;return this;},
        gte(k,v){filters.from=v;return this;}, lt(k,v){filters.until=v;return this;},
        order(){return this;}, range(){return this;}, async throwOnError(){
          assert.deepEqual(filters,{child_id:child,parent_id:'fixture-parent',
            from:'2026-11-22T18:30:00.000Z',until:'2026-11-23T18:30:00.000Z'});
          return {data:[{id:'legacy',last_watched_at:filters.from,progress_percent:50,absolute_position:60,
            videos:{id:'video',youtube_video_id:'abcdefghijk',title:'Older video',thumbnail_url:'',
              channels:{title:'Channel',parent_id:'fixture-parent'}}}]};
        }};
    }
    const filters = {};
    return { select(){return this;}, eq(key,value){filters[key]=value;return this;},
      limit:async()=>({error:{code:'PGRST205'}}),
      async maybeSingle(){
        assert.equal(filters.parent_id,'fixture-parent');
        if(table==='children') return {data: linked && filters.id===child ? {id:child} : null};
        assert.equal(table,'child_watch_daily');
        assert.equal(filters.child_id,child);
        return {data:{seconds_watched:900}};
      }
    };
  }
};
const day = {kind:'day',child_id:child,date:'2026-11-23',timezone:'Asia/Kolkata'};
const legacy = await childActivity(admin,'fixture',day,new Date().toISOString());
assert.equal(legacy.status,200);
const details = await legacy.json();
assert.equal(details.tracking_setup_required,true);
assert.equal(details.has_watch_history,true);
assert.equal(details.visits.length,0);
assert.equal(details.playback,900);
assert.equal(details.history[0].card.title,'Older video');
linked=false;
assert.equal((await childActivity(admin,'fixture',day,new Date().toISOString())).status,403);
console.log('PASS: authorized historical playback and unrelated-parent denial with missing visit schema.');

// Render can reach the authenticated Edge Function with just its public Supabase config.
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-public';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const request = body => new Request('http://localhost/api/child-activity',{
  method:'POST',headers:{authorization:'Bearer fixture-viewer'},body:JSON.stringify(body)
});
try {
  for (const [body, expectedStatus, expectedData] of [
    [day,200,{visits:[],website:0,playback:0,coverage:'full'}],
    [day,403,{}],
    [{kind:'join'},200,{visit:'fixture-visit'}]
  ]) {
    let forwarded = false;
    globalThis.fetch = async (url,options) => {
      assert.equal(url,base+'/functions/v1/child-activity');
      assert.equal(options.headers.authorization,'Bearer fixture-viewer');
      assert.equal(options.headers.apikey,'fixture-public');
      assert.deepEqual(JSON.parse(options.body),body);
      forwarded = true;
      return Response.json(expectedData,{status:expectedStatus});
    };
    const response = await POST(request(body));
    assert.equal(response.status,expectedStatus);
    assert.deepEqual(await response.json(),expectedData);
    assert.equal(forwarded,true);
  }
  console.log('PASS: Render route reads and writes without a service key and preserves parent denial.');
} finally {
  globalThis.fetch = originalFetch;
}

// Reproduce Render forwarding a pre-card Edge response with only public server config.
try {
  const starts = ['abcdefghijk','Bird songs','abcdefghijk','Deleted'].map((title,i) =>
    ({id:String(i),at:'2026-11-23T04:0'+i+':00Z',title}));
  const catalog = ['Forest','Bird songs'].map((title,i)=>({
    id:'00000000-0000-4000-8000-00000000000'+i,youtube_video_id:i?'lmnopqrstuv':'abcdefghijk',
    title,thumbnail_url:'/thumb-'+i,channels:{title:'Nature'}
  }));
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(new Headers(options.headers).get('authorization'),'Bearer fixture-viewer');
    requests.push(url.pathname);
    if (url.pathname.endsWith('/child-activity')) return Response.json({visits:[{starts}]});
    if (url.pathname.endsWith('/videos')) return Response.json(catalog.filter(video =>
      ['youtube_video_id','title'].some(k=>url.searchParams.get(k)?.includes(JSON.stringify(video[k])))));
    assert.equal(url.pathname,'/rest/v1/watch_sessions');
    assert.equal(url.searchParams.get('child_id'),'eq.'+child);
    return Response.json([{video_id:catalog[0].id,absolute_position:37,progress_percent:42}]);
  };
  const result = await POST(request(day));
  assert.equal(result.status,200);
  const cards = (await result.json()).visits[0].starts;
  assert.deepEqual(cards.map(s=>s.card?.title),['Forest','Bird songs','Forest',undefined]);
  assert.deepEqual(cards.map(s=>s.at),starts.map(s=>s.at));
  assert.equal(cards[0].card.thumbnail,'/thumb-0');
  assert.equal(cards[0].card.resume,37);
  assert.equal(requests.filter(p=>p.endsWith('/watch_sessions')).length,1);
  console.log('PASS: legacy Edge response on Render resolves repeated IDs and exact titles with viewer-scoped batched reads.');
} finally {
  globalThis.fetch = originalFetch;
}

for (const viewer of [child,'fixture-parent']) {
  const video = {id:child,youtube_video_id:'abcdefghijk',title:'Watched video',thumbnail_url:'',
    channels:{parent_id:'catalog-owner',title:'Nature'}};
  const db = {
    auth:{getUser:async()=>({data:{user:{id:viewer}}})},
    rpc:async()=>({data:{visits:[{starts:[{id:'event',at:'2026-11-23T05:00:00Z',title:null}]}]}}),
    from(table) {
      const filters = {};
      return {
        select(){return this},eq(k,v){filters[k]=v;return this},in(){return this},order(){return this},single(){return this},
        async throwOnError(){
          if(table==='children')return {data:{parent_id:'fixture-parent'}};
          if(table==='child_activity_events')return {data:[{id:'event',video:'abcdefghijk'}]};
          if(table==='videos')return {data:[]};
          assert.equal(table,'watch_sessions');
          assert.deepEqual(filters,{child_id:child,parent_id:'fixture-parent'});
          return {data:[{videos:video,absolute_position:91,progress_percent:70}]};
        }
      };
    }
  };
  const response=await childActivity(db,'test',day,new Date().toISOString());
  assert.equal(response.status,200);
  const card=(await response.json()).visits[0].starts[0].card;
  assert.equal(card.target,video.youtube_video_id);
  assert.match(card.thumbnail,/abcdefghijk/);
  assert.equal(card.resume,91);
}
console.log('PASS: parent and child resolve an out-of-catalog video through their own watch record.');
