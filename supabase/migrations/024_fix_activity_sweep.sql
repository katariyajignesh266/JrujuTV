create or replace function public.activity_sweep() returns void language plpgsql set search_path=public as $$
declare expired_visit child_visits;
begin
 for expired_visit in select * from child_visits where closed_at is null and due_at<=now() order by due_at limit 500 for update skip locked
 loop perform activity_close(expired_visit); end loop;
 -- Drop stale jobs after subscription reassignment or prolonged delivery failures.
 update activity_deliveries q set finished=true
 from child_activity_events e join child_visits v on v.id=e.visit_id join children c on c.id=v.child_id,
 push_subscriptions s where e.id=q.event_id and s.id=q.subscription_id and not q.finished
 and (c.parent_id<>s.parent_id or e.persisted_at<now()-interval '1 hour');
end $$;
