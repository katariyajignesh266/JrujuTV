-- A visit spans documents in one browser profile. All mutations serialize on the visit row.
-- Record the reporting cutover without reconstructing visits from legacy watch rows.
create table public.activity_cutover (singleton boolean primary key check(singleton), started_at timestamptz not null);
insert into public.activity_cutover values(true,now());
alter table public.activity_cutover enable row level security;
revoke all on public.activity_cutover from public,anon,authenticated;
alter function public.record_watch_progress(uuid,uuid,uuid,uuid,int,double precision,int,timestamptz) set timezone='Asia/Kolkata';
alter function public.get_child_watch_summary(uuid) set timezone='Asia/Kolkata';
alter function public.get_children_today_summary(uuid) set timezone='Asia/Kolkata';

create table public.child_visits (
 id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children(id) on delete cascade,
 browser_id uuid not null, opened_at timestamptz not null, last_seen timestamptz not null,
 due_at timestamptz not null, closed_at timestamptz, inferred boolean not null default false
);
create unique index child_visits_active on public.child_visits(child_id,browser_id) where closed_at is null;
create index child_visits_day on public.child_visits(child_id,opened_at);
create index child_visits_due on public.child_visits(due_at) where closed_at is null;
create table public.activity_documents (
 id uuid primary key, visit_id uuid not null references public.child_visits on delete cascade,
 seen timestamptz not null, expires timestamptz not null, departed boolean not null default false
);
create index activity_documents_visit on public.activity_documents(visit_id);
create table public.child_activity_events (
 id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.child_visits on delete cascade,
 kind text not null check(kind in ('open','start','close')), occurred_at timestamptz not null,
 source_id uuid, received_at timestamptz not null, persisted_at timestamptz not null default clock_timestamp(),
 playback_id uuid, video text, title text, ordinal bigint generated always as identity
);
create unique index child_activity_boundaries on public.child_activity_events(visit_id,kind) where kind <> 'start';
create unique index activity_playback_once on public.child_activity_events(visit_id,playback_id);
create index child_activity_timeline on public.child_activity_events(visit_id,occurred_at,ordinal);
create table public.activity_play_intervals (
 id uuid primary key, start_event uuid not null references public.child_activity_events on delete cascade,
 began timestamptz not null, ended timestamptz not null check(ended>=began)
);
create index activity_play_by_start on public.activity_play_intervals(start_event);
create table public.activity_deliveries (
 event_id uuid references public.child_activity_events on delete cascade,
 subscription_id uuid references public.push_subscriptions on delete cascade,
 primary key(event_id,subscription_id), attempt int not null default 0, due timestamptz not null default now(),
 submitted_at timestamptz, accepted_at timestamptz, finished boolean not null default false, status int
);
create index activity_delivery_due on public.activity_deliveries(due) where not finished;
alter table public.child_visits enable row level security;
alter table public.activity_documents enable row level security;
alter table public.child_activity_events enable row level security;
alter table public.activity_play_intervals enable row level security;
alter table public.activity_deliveries enable row level security;

revoke all on public.child_visits, public.activity_documents, public.child_activity_events,
 public.activity_play_intervals, public.activity_deliveries from public,anon,authenticated;

create function public.activity_enqueue() returns trigger language plpgsql set search_path=public as $$
begin
 insert into activity_deliveries(event_id,subscription_id)
 select new.id,s.id from child_visits v join children c on c.id=v.child_id
 join push_subscriptions s on s.parent_id=c.parent_id where v.id=new.visit_id;
 return new;
end $$;
create trigger activity_enqueue after insert on public.child_activity_events
 for each row execute function public.activity_enqueue();

create function public.activity_close(v child_visits) returns void language plpgsql set search_path=public as $$
begin
 update child_visits set closed_at=last_seen, inferred=exists(
 select 1 from activity_documents d where d.visit_id=v.id and not departed and d.expires=v.due_at)
 where id=v.id and closed_at is null;
 if found then
 insert into child_activity_events(visit_id,kind,occurred_at,received_at) values(v.id,'close',v.last_seen,clock_timestamp());
 end if;
end $$;

create function public.activity_record(p_child uuid,p_browser uuid,p_doc uuid,p_kind text,p_event uuid,
 p_time timestamptz,p_video text,p_title text,p_start uuid,p_began timestamptz,p_received timestamptz)
returns jsonb language plpgsql set search_path=public as $$
declare v child_visits; d activity_documents; t timestamptz := least(p_time,p_received);
begin
 if p_kind not in ('join','presence','depart','logout','start','interval') or t is null or
 p_time < p_received-interval '1 day' then raise exception 'invalid activity'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_child::text||p_browser::text,0));
 select * into d from activity_documents where id=p_doc;
 if found then
 select * into strict v from child_visits where id=d.visit_id and child_id=p_child and browser_id=p_browser for update;
 else
 if p_kind <> 'join' then return jsonb_build_object('needsJoin',true); end if;
 select * into v from child_visits where child_id=p_child and browser_id=p_browser and closed_at is null for update;
 if found and v.due_at < now() then perform activity_close(v); v.id:=null; end if;
 if v.id is null then
 insert into child_visits(child_id,browser_id,opened_at,last_seen,due_at)
 values(p_child,p_browser,t,t,p_received+interval '60 seconds') returning * into v;
 insert into child_activity_events(source_id,visit_id,kind,occurred_at,received_at) values(p_event,v.id,'open',t,p_received);
 end if;
 insert into activity_documents values(p_doc,v.id,t,p_received+interval '60 seconds',false) returning * into d;
 end if;
 if v.closed_at is null and p_kind in ('join','presence','start') and t>v.due_at then
 perform activity_close(v);
 select * into strict v from child_visits where id=d.visit_id;
 end if;
 if v.closed_at is not null then
 -- A delayed explicit departure can refine a last-seen estimate, but never cross the next visit.
 if v.inferred and p_kind='depart' and t>=v.closed_at and t<=v.due_at and d.expires=v.due_at and not exists(
 select from child_visits n where n.child_id=v.child_id and n.browser_id=v.browser_id
 and n.id<>v.id and n.opened_at between v.closed_at and t) then
 update child_visits set closed_at=t,last_seen=t,inferred=false where id=v.id;
 update child_activity_events set occurred_at=t where visit_id=v.id and kind='close';
 end if;
 return jsonb_build_object('closed',true,'visit',v.id);
 end if;
 t:=greatest(t,v.opened_at);
 if p_kind='start' then
 insert into child_activity_events(playback_id,source_id,visit_id,kind,occurred_at,received_at,video,title)
 values(p_event,p_event,v.id,'start',t,p_received,left(p_video,100),left(p_title,250)) on conflict do nothing;
 elsif p_kind='interval' then
 insert into activity_play_intervals select p_event,e.id,greatest(e.occurred_at,p_began,t-interval '30 seconds'),t
 from child_activity_events e where p_began<=t and e.occurred_at<=t and e.playback_id=p_start and e.visit_id=v.id
 on conflict do nothing;
 end if;
 if p_kind='logout' then
 update activity_documents set departed=true,seen=greatest(seen,t),expires=p_received where visit_id=v.id;
 elsif (t>d.seen or (p_kind='depart' and not d.departed and t=d.seen)) and (not d.departed or p_kind='depart') then
 update activity_documents set seen=t,departed=p_kind='depart',
 expires=p_received+case when p_kind='depart' then interval '5 seconds' else interval '60 seconds' end where id=p_doc;
 end if;
 update child_visits set last_seen=greatest(last_seen,t),due_at=(select max(expires) from activity_documents where visit_id=v.id)
 where id=v.id returning * into v;
 if p_kind='logout' then perform activity_close(v); end if;
 return jsonb_build_object('visit',v.id);
end $$;

create function public.activity_sweep() returns void language plpgsql set search_path=public as $$
declare v child_visits;
begin
 for v in select * from child_visits where closed_at is null and due_at<=now() order by due_at limit 500 for update skip locked
 loop perform activity_close(v); end loop;
 -- Drop stale jobs after subscription reassignment or prolonged delivery failures.
 update activity_deliveries q set finished=true
 from child_activity_events e join child_visits v on v.id=e.visit_id join children c on c.id=v.child_id,
 push_subscriptions s where e.id=q.event_id and s.id=q.subscription_id and not q.finished
 and (c.parent_id<>s.parent_id or e.persisted_at<now()-interval '1 hour');
end $$;

-- Claim only the earliest pending event for each visit/subscription.
create function public.activity_claim(p_visit uuid default null) returns table(
 event_id uuid, subscription_id uuid, attempt int, endpoint text,p256dh text,auth text,
 kind text,child_name text,occurred_at timestamptz) language sql set search_path=public as $$
 with ready as (
 select q.event_id,q.subscription_id from activity_deliveries q join child_activity_events e on e.id=q.event_id
 where not q.finished and q.due<=now() and (p_visit is null or e.visit_id=p_visit)
 and not exists(select from activity_deliveries old join child_activity_events prior on prior.id=old.event_id
 where old.subscription_id=q.subscription_id and not old.finished and prior.visit_id=e.visit_id and prior.ordinal<e.ordinal)
 order by q.due limit 50 for update of q skip locked
 ), claimed as (
 update activity_deliveries q set attempt=q.attempt+1,due=now()+interval '45 seconds',submitted_at=clock_timestamp()
 from ready r where (q.event_id,q.subscription_id)=(r.event_id,r.subscription_id) returning q.*
 )
 select q.event_id,q.subscription_id,q.attempt,s.endpoint,s.p256dh,s.auth,e.kind,c.display_name::text,e.occurred_at
 from claimed q join child_activity_events e on e.id=q.event_id join child_visits v on v.id=e.visit_id
 join children c on c.id=v.child_id join push_subscriptions s on s.id=q.subscription_id and s.parent_id=c.parent_id
 $$;

create function public.child_activity_day(p_viewer uuid,p_child uuid,p_date date) returns jsonb
 language plpgsql set search_path=public as $$
declare a timestamptz:=p_date::timestamp at time zone 'Asia/Kolkata';
 b timestamptz:=(p_date+1)::timestamp at time zone 'Asia/Kolkata'; result jsonb;
begin
 if not exists(select from children where id=p_child and (id=p_viewer or parent_id=p_viewer))
 then raise insufficient_privilege; end if;
 with visits as (
 select v.*, greatest(opened_at,a) lo,least(coalesce(closed_at,case when due_at>now() then now() else last_seen end),b) hi
 from child_visits v where child_id=p_child and opened_at<b and (closed_at is null or closed_at>a)
 ), rows as (
 select v.*,coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'at',occurred_at,'title',coalesce(nullif(title,''),video)) order by occurred_at,ordinal)
 from child_activity_events e where e.visit_id=v.id and kind='start' and occurred_at>=a and occurred_at<b),'[]') starts
 from visits v where hi>=lo
 ), ranges as (
 select 'website' metric,tstzrange(lo,hi,'[)') r from rows
 union all select 'playback',tstzrange(greatest(i.began,a),least(i.ended,b),'[)')
 from activity_play_intervals i join child_activity_events e on e.id=i.start_event join rows on rows.id=e.visit_id
 where i.ended>a and i.began<b
 ), merged as (select metric,unnest(range_agg(r)) r from ranges group by metric),
 totals as (select metric,sum(extract(epoch from upper(r)-lower(r))) seconds from merged group by metric)
 select jsonb_build_object('website',coalesce((select seconds from totals where metric='website'),0),
 'playback',coalesce((select seconds from totals where metric='playback'),0),
 'coverage', (select case when b<=started_at then 'unavailable' when a<started_at then 'partial' else 'full' end from activity_cutover),
 'visits',coalesce((select jsonb_agg(jsonb_build_object('id',id,'opened',opened_at,'closed',closed_at,'inferred',inferred,
 'seconds',extract(epoch from hi-lo),'starts',starts) order by opened_at,id) from rows),'[]')) into result;
 return result;
end $$;

revoke all on function public.child_activity_day(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.child_activity_day(uuid,uuid,date) to service_role;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and
 proname in ('activity_record','activity_claim','activity_close','activity_sweep','activity_enqueue') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;

-- Existing pg_cron/pg_net installation. Provision both Vault secrets before enabling clients.
select cron.schedule('child-activity-maintenance','5 seconds',$job$
 select public.activity_sweep();
 select net.http_post(url:=u.decrypted_secret||'/functions/v1/child-activity',headers:=
 jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k.decrypted_secret),
 body:='{"kind":"dispatch"}'::jsonb)
 from vault.decrypted_secrets u,vault.decrypted_secrets k where u.name='activity_supabase_url'
 and k.name='activity_dispatch_token' and exists(select from public.activity_deliveries where not finished and due<=now());
$job$);
