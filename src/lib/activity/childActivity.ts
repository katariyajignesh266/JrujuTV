'use client';

type Kind = 'join' | 'presence' | 'depart' | 'logout' | 'start' | 'interval';
type Signal = {
  kind: Kind; id: string; browser: string; document: string; at: string;
  video?: string; title?: string; start?: string; began?: string;
};
type Entry = { key: string; signal: Signal };
type Identity = { child: string; token: string };
const prefix = 'jruju.activity.';
const uid = () => crypto.randomUUID();
let identity: Identity | null = null;
let doc = '';
let browser = '';
let sequence = 0;
let joined = false;
let leaseReplies: BroadcastChannel | undefined;
let running: Promise<void> | undefined;
let playing: { video: string; id: string; since: number } | undefined;
let selected: { video: string; id: string } | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let departing = false;
let firstDocument = true;

function keys(child: string): Entry[] {
  const items: Entry[] = [];
  for (const key of Object.keys(localStorage).filter(k => k.startsWith(prefix + child + '.')).sort()) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const signal: Signal = JSON.parse(raw);
    if (Date.now() - Date.parse(signal.at) > 86400000) localStorage.removeItem(key);
    else items.push({key,signal});
  }
  return items;
}

async function send(s: Signal, token: string) {
  return fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/child-activity', {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
    body: JSON.stringify(s)
  });
}

function drain() {
  if (running || !identity) return running;
  const owner = identity.child;
  let retry = false;
  const work = async () => {
    while (identity?.child === owner) {
      const entry = keys(owner)[0];
      if (!entry) break;
      const res = await send(entry.signal, identity.token);
      if (res.status === 400) { localStorage.removeItem(entry.key); continue; }
      if (!res.ok) { retry = true; break; }
      const result = await res.json();
      if (result.visit && entry.signal.document === doc) joined = !result.closed;
      localStorage.removeItem(entry.key);
      if (result.closed || result.needsJoin) {
        renewExpiredDocument(entry.signal.document);
        leaseReplies?.postMessage(entry.signal.document);
      }
    }
  };
  running = (navigator.locks ? navigator.locks.request(prefix+owner, work) : work())
    .then(() => undefined)
    .catch(() => { retry = true; })
    .finally(() => {
      running = undefined;
      if (!identity) return;
      if (retry) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(drain, 3000);
      } else if (keys(identity.child).length) void drain();
    });
  return running;
}

function renewExpiredDocument(expired: string) {
  if (expired !== doc || departing || !identity || document.visibilityState !== 'visible') return;
  const activeVideo = playing?.video;
  doc = uid();
  joined = false;
  selected = undefined;
  playing = undefined;
  sessionStorage.removeItem(prefix+'selection');
  enqueue('join');
  if (activeVideo) confirmedPlayback(activeVideo);
}

function enqueue(kind: Kind, extras: Partial<Signal> = {}) {
  if (!identity || !doc) return;
  const now = Date.now();
  const signal: Signal = { kind, id: uid(), browser, document: doc, at: new Date(now).toISOString(), ...extras };
  // Independent keys prevent concurrent tabs from overwriting one another's pending events.
  localStorage.setItem(prefix+identity.child+'.'+now+'.'+doc+'.'+String(++sequence).padStart(10,'0'),JSON.stringify(signal));
  void drain();
  // The document may disappear before the lock callback gets a turn.
  // An established lease can accept the same departure concurrently and on retry.
  if (kind === 'depart' && joined) void send(signal,identity.token).catch(()=>undefined);
}

function sample(stop: boolean) {
  if (!playing) return;
  const now = Date.now();
  if (now > playing.since) enqueue('interval', {start:playing.id,
    began:new Date(Math.max(playing.since,now-30000)).toISOString()});
  if (stop) playing = undefined;
  else playing.since = now;
}

export async function activateChild(child: string, token: string) {
  if (identity?.child === child && doc && !departing) { identity.token = token; return; }
  if (identity && identity.child !== child) clearIdentity();
  const next = { child, token };
  identity = next;
  const init = () => {
    if (identity !== next || document.visibilityState !== 'visible') return;
    if (!leaseReplies && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      leaseReplies = new BroadcastChannel(prefix+'leases');
      leaseReplies.onmessage = event => renewExpiredDocument(event.data);
    }
    browser = localStorage.getItem(prefix+'browser') || uid();
    localStorage.setItem(prefix+'browser',browser);
    if (firstDocument && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type !== 'reload') {
      sessionStorage.removeItem(prefix+'selection');
    }
    firstDocument = false;
    doc = uid();
    joined = false;
    departing = false;
    enqueue('join');
    if (pendingPlay) {
      const pending = pendingPlay;
      pendingPlay = undefined;
      confirmedPlayback(pending.video,pending.title);
    }
  };
  if (navigator.locks) await navigator.locks.request(prefix+'browser',init);
  else init();
}

let pendingPlay: { video:string; title?:string } | undefined;
export function confirmedPlayback(video: string, title?: string) {
  if (!identity || !doc || departing) { pendingPlay = {video,title}; return; }
  if (playing?.video === video) return;
  sample(true);
  if (!selected || selected.video !== video) {
    const stored = JSON.parse(sessionStorage.getItem(prefix+'selection') || 'null');
    const id = stored?.child === identity.child && stored.video === video ? stored.id : uid();
    selected = {video,id};
    sessionStorage.setItem(prefix+'selection',JSON.stringify({child:identity.child,video,id}));
    enqueue('start',{id,video,title});
  }
  playing = { video,id:selected.id,since:Date.now() };
}

export function pauseActivity(video: string, ended = false) {
  if (pendingPlay?.video === video) pendingPlay = undefined;
  if (playing?.video === video) sample(true);
  if (ended && selected?.video === video) resetSelection();
}

export function selectActivityVideo(video: string) {
  const previous = selected?.video || JSON.parse(sessionStorage.getItem(prefix+'selection') || 'null')?.video;
  if (previous && previous !== video) resetSelection();
}

export function resetSelection() {
  sample(true);
  selected = undefined;
  pendingPlay = undefined;
  sessionStorage.removeItem(prefix+'selection');
}

export function presence() {
  if (!identity || departing) return;
  sample(false);
  enqueue('presence');
}

export function leaveActivity(logout = false) {
  if (!identity || departing) return;
  sample(true);
  departing = true;
  enqueue(logout ? 'logout' : 'depart');
  if (logout) resetSelection();
}

export async function logoutActivity() {
  leaveActivity(true);
  if (running) await Promise.race([running,new Promise(resolve => setTimeout(resolve,1200))]);
}

export function clearIdentity() {
  leaveActivity(true);
  identity = null;
  doc = '';
  playing = selected = pendingPlay = undefined;
}
