-- Run with psql -v ON_ERROR_STOP=1 -f supabase/tests/child_activity.sql against a migrated test database.
begin;
do $$
declare child uuid:=gen_random_uuid(); parent uuid:=gen_random_uuid(); browser uuid:=gen_random_uuid();
 doc uuid:=gen_random_uuid(); second_doc uuid:=gen_random_uuid(); play uuid:=gen_random_uuid(); visit uuid;
 t timestamptz:=clock_timestamp(); day date:='2030-06-10'; midnight timestamptz:=day::timestamp at time zone 'Asia/Kolkata';
 result jsonb; item record;
begin
 insert into auth.users(id) values(parent),(child);
 insert into profiles(id,full_name,email) values(parent,'Fixture','fixture@example.invalid') on conflict do nothing;
 insert into children(id,parent_id,username,display_name) values(child,parent,child::text,'Fixture');
 visit := (activity_record(child,browser,doc,'join',gen_random_uuid(),t,null,null,null,null,t)->>'visit')::uuid;
 perform activity_record(child,browser,second_doc,'join',gen_random_uuid(),t,null,null,null,null,t);
 perform activity_record(child,browser,doc,'start',play,t,'A','Fixture',null,null,t);
 perform activity_record(child,browser,doc,'start',play,t,'A','Fixture',null,null,t);
 perform activity_record(child,browser,doc,'depart',gen_random_uuid(),t,null,null,null,null,t);
 if (select count(*) from child_activity_events where visit_id=visit)<>2 or
 (select due_at from child_visits where id=visit)<>t+interval '60 seconds' then
 raise exception 'Duplicate boundary/start or premature multi-tab close'; end if;
 perform activity_record(child,browser,second_doc,'depart',gen_random_uuid(),t,null,null,null,null,t);
 if (select due_at from child_visits where id=visit)<>t+interval '5 seconds' then raise exception 'departure grace'; end if;
 update child_visits set due_at=now()-interval '1 second' where id=visit;
 perform activity_sweep();
 perform activity_record(child,browser,second_doc,'depart',gen_random_uuid(),t,null,null,null,null,t);
 if (select count(*) from child_activity_events where visit_id=visit and kind='close')<>1 then raise exception 'duplicate close'; end if;

 -- Verify the recording RPC's actual result through the same day RPC for both viewers.
 result:=child_activity_day(parent,child,(t at time zone 'Asia/Kolkata')::date);
 if result is distinct from child_activity_day(child,child,(t at time zone 'Asia/Kolkata')::date)
 or result#>>'{visits,0,id}' is distinct from visit::text
 or result#>>'{visits,0,starts,0,title}' is distinct from 'Fixture'
 or jsonb_array_length(result#>'{visits,0,starts}')<>1
 or result#>>'{visits,0,closed}' is null then raise exception 'fresh visit failed round trip'; end if;
 if (select count(*) from child_visits where child_id=child)<>1 then raise exception 'read created visit'; end if;
 if ('2026-11-23'::date::timestamp at time zone 'Asia/Kolkata') <> '2026-11-22 18:30Z'::timestamptz or
 ('2026-11-24'::date::timestamp at time zone 'Asia/Kolkata') <> '2026-11-23 18:30Z'::timestamptz
 then raise exception 'local midnight boundary'; end if;

 -- Midnight crossing, overlapping devices, and three non-overlapping contributions of 30, 60, 45 minutes.
 for item in select * from (values(-10,30),(5,18),(60,120),(160,205)) minutes(lo,hi) loop
 insert into child_visits(child_id,browser_id,opened_at,last_seen,due_at,closed_at)
 values(child,gen_random_uuid(),midnight+item.lo*interval '1 minute',midnight+item.hi*interval '1 minute',
 midnight+item.hi*interval '1 minute',midnight+item.hi*interval '1 minute');
 end loop;
 result:=child_activity_day(parent,child,day);
 if (result->>'website')::numeric<>8100 or jsonb_array_length(result->'visits')<>4 or
 (result->>'playback')::numeric<>0 or child_activity_day(child,child,day)<>result then raise exception 'daily union or access'; end if;
 begin
 perform child_activity_day(gen_random_uuid(),child,day);
 raise exception 'unrelated viewer could read activity';
 exception when insufficient_privilege then null;
 end;
 if has_function_privilege('authenticated','public.child_activity_day(uuid,uuid,date)','EXECUTE') then
 raise exception 'privileged read RPC was exposed directly'; end if;
end $$;
rollback;
