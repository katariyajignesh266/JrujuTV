import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setTimeout as wait } from 'node:timers/promises';
import * as activity from '../src/lib/activity/childActivity.ts';

class Storage {
  getItem(key) { return this[key] ?? null; }
  setItem(key,value) { this[key] = String(value); }
  removeItem(key) { delete this[key]; }
}
globalThis.localStorage = new Storage();
globalThis.sessionStorage = new Storage();
globalThis.document = {visibilityState:'visible'};
const calls=[];
let failNext=false;
globalThis.fetch=async (_,options)=>{
  const signal=JSON.parse(options.body);
  calls.push(signal);
  if (failNext) { failNext=false; throw new Error('fixture offline'); }
  return Response.json({visit:'fixture'});
};
async function settled() {
  for(let i=0;i<100;i++) {
    if(!Object.keys(localStorage).some(k=>k.startsWith('jruju.activity.child.'))) return;
    await wait(5);
  }
  assert.fail('queue did not drain');
}
await activity.activateChild('child','test-token');
activity.confirmedPlayback('A','First');
activity.pauseActivity('A');
activity.confirmedPlayback('A','First');
activity.selectActivityVideo('failed');
activity.selectActivityVideo('B');
activity.confirmedPlayback('B','Second');
activity.presence();
await settled();
assert.deepEqual(calls.filter(s=>['join','start'].includes(s.kind)).map(s=>s.video??s.kind),['join','A','B']);
activity.pauseActivity('B',true);
failNext=true;
activity.confirmedPlayback('B','Replay');
await wait(10);
activity.presence();
await settled();
const replay=calls.filter(s=>s.title==='Replay');
assert.equal(replay.length,2);
assert.equal(replay[0].id,replay[1].id);
assert.notEqual(replay[0].id,calls.find(s=>s.title==='Second').id);
activity.leaveActivity();
await settled();
assert.equal(new Set(calls.filter(s=>s.kind==='depart').map(s=>s.id)).size,1);
activity.clearIdentity();

// Exercise the shipped service-worker handler with a receipt cache and notification surface.
const listeners={}, shown=[], receipts=new Map();
const self={ location:new URL('https://fixture.invalid'),addEventListener:(name,fn)=>listeners[name]=fn,
  registration:{showNotification:async(title,opts)=>shown.push({title,...opts})}};
vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
  self,URL,Date,Response,console,caches:{open:async()=>({match:k=>receipts.get(k),put:(k,v)=>receipts.set(k,v),
    keys:()=>[...receipts.keys()],delete:k=>receipts.delete(k)})}
});
const eventIds=Array.from({length:3},()=>crypto.randomUUID());
for(const id of [...eventIds,eventIds[0]]) {
  let finished;
  listeners.push({data:{json:()=>({data:{event_id:id,occurred_at:'2026-11-23T04:16:00Z'}})},waitUntil:p=>finished=p});
  await finished;
}
assert.deepEqual(shown.map(n=>n.tag),eventIds);
assert(shown.every(n=>n.badge==='/icons/notification-badge-v1.png' && n.icon==='/icons/icon-192x192.png'));
assert(shown.every(n=>n.timestamp===Date.parse('2026-11-23T04:16:00Z')));
console.log('Passed: open/start order, failed selection, pause/resume, replay, retry IDs, departure and service-worker display deduplication.');
