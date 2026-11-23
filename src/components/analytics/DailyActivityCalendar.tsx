'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { ActivityLoadError, loadActivityDay, reportingZone as zone, type ActivityDay } from '@/lib/activity/loadActivityDay';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const stamp = (s: string) => new Intl.DateTimeFormat('en-IN',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(s));
const duration = (s: number) => {
  const seconds = Math.max(0,Math.floor(s));
  const minutes = Math.floor(seconds/60);
  return minutes >= 60 ? Math.floor(minutes/60)+' hr'+(minutes%60 ? ' '+minutes%60+' min' : '') :
    minutes ? minutes+' min' : seconds+' sec';
};
export function DailyActivityCalendar({childId,accessToken}:{childId:string;accessToken:string}) {
  const today = dayKey(new Date());
  const [date,setDate] = useState(today);
  const [month,setMonth] = useState(today.slice(0,7));
  const [result,setResult] = useState<{key:string;value:ActivityDay}|null>(null);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const key = childId+'/'+date;
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    setError('');
    setResult(null);
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const value = await loadActivityDay(childId, date, accessToken, controller.signal);
        if (!controller.signal.aborted) { setResult({key,value}); setError(''); }
      } catch (cause) {
        if (controller.signal.aborted) return;
        const failure = cause instanceof ActivityLoadError ? cause :
          new ActivityLoadError('network', 0, 'Could not reach the activity service. Check your connection.');
        console.warn('[DailyActivity]', failure.reason, failure.status);
        setError(failure.message);
      } finally { busy=false; }
    }
    void refresh();
    const tick=setInterval(()=>{ if (date===dayKey(new Date()) && !document.hidden) void refresh(); },15000);
    return ()=>{controller.abort();clearInterval(tick);};
  },[accessToken,childId,date,key,retry]);
  const data=result?.key===key ? result.value : null;
  const first=new Date(month+'-01T12:00:00Z');
  const days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  function move(n:number) {
    const next=new Date(first);
    next.setUTCMonth(next.getUTCMonth()+n);
    const nextMonth=next.toISOString().slice(0,7);
    setMonth(nextMonth);
    setDate(nextMonth===today.slice(0,7) ? today : nextMonth+'-01');
  }
  return <section aria-label="Daily activity" className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-4">
    <h3 className="flex items-center gap-2 font-semibold"><CalendarDays size={16}/> Daily activity</h3>
    <div className="flex items-center justify-between">
      <button type="button" aria-label="Previous month" className="p-2" onClick={()=>move(-1)}><ChevronLeft size={18}/></button>
      <strong>{first.toLocaleDateString('en-IN',{timeZone:zone,month:'long',year:'numeric'})}</strong>
      <button type="button" aria-label="Next month" className="p-2 disabled:opacity-30" disabled={month>=today.slice(0,7)} onClick={()=>move(1)}><ChevronRight size={18}/></button>
    </div>
    <div className="grid grid-cols-7 text-center text-sm gap-y-1">
      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><span key={d} className="text-content-secondary">{d}</span>)}
      {Array.from({length:first.getUTCDay()},(_,i)=><span key={'pad'+i}/>)}
      {Array.from({length:days},(_,i)=>{
        const d=month+'-'+String(i+1).padStart(2,'0');
        return <button type="button" key={d} aria-label={d} aria-pressed={d===date} disabled={d>today}
          className={'rounded-lg py-2 disabled:opacity-30 '+(d===date?'bg-brand-primary text-white font-semibold':'hover:bg-surface-secondary')}
          onClick={()=>setDate(d)}>{i+1}</button>;
      })}
    </div>
    <p className="text-xs text-content-secondary">{date} · India Standard Time</p>
    {error ? <p role="alert">{error} <button type="button" className="underline" onClick={()=>{setError(''); setResult(null); setRetry(n=>n+1);}}>Retry</button></p> :
      !data ? <p role="status">Loading activity…</p> : <>
        {data.tracking_setup_required && <p className="text-sm">Visit tracking is awaiting database setup.</p>}
        {data.coverage === 'partial' && <p className="text-sm">Visit tracking began during this day.</p>}
        {!data.visits.length && <p className="text-sm">
          {data.has_watch_history
            ? 'Playback was recorded, but visit details are unavailable for this date.'
            : data.coverage === 'unavailable' ? 'Visit tracking was unavailable on this date.' : 'No visits recorded for this date.'}
        </p>}
        {data.visits.map(v=><article key={v.id} className="border-t border-border pt-3 space-y-1 text-sm">
          <p><strong>Opened</strong> · <time dateTime={v.opened}>{stamp(v.opened)}</time></p>
          {v.starts.map(s=><p key={s.id}>Started watching · <time dateTime={s.at}>{stamp(s.at)}</time>{s.title && ' · '+s.title}</p>)}
          <p>{v.closed ? <>{v.inferred?'Closed (estimated, last seen)':'Closed'} · <time dateTime={v.closed}>{stamp(v.closed)}</time></>:'Still open'}</p>
          <p>Time on website · {duration(v.seconds)}</p>
        </article>)}
        {(data.visits.length > 0 || (data.coverage!=='unavailable' && !data.has_watch_history)) && <div className="border-t border-border pt-3 text-sm">
          <strong>Daily total · Time on website · {duration(data.website)}</strong>
          <p>Playback time · {duration(data.playback)}</p>
        </div>}
      </>}
  </section>;
}
