create function public.claim_umrah_pool_emails(p_limit integer default 25)
returns setof public.umrah_pool_email_jobs language sql security definer set search_path=public as $$
 update public.umrah_pool_email_jobs j set status='sending',attempts=j.attempts+1,claimed_at=now(),claim_token=gen_random_uuid()
 where j.id in(select q.id from public.umrah_pool_email_jobs q where q.attempts<10 and
  ((q.status='pending' and q.available_at<=now()) or (q.status='sending' and q.claimed_at<now()-interval '10 minutes'))
  order by q.created_at limit greatest(1,least(p_limit,100)) for update skip locked)
 returning j.*;
$$;
revoke all on function public.claim_umrah_pool_emails(integer) from public,anon,authenticated;
grant execute on function public.claim_umrah_pool_emails(integer) to service_role;
create function public.finish_umrah_pool_email(p_id uuid,p_token uuid,p_outcome text,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_outcome not in ('sent','skipped','failed') then raise exception 'Invalid mail outcome.'; end if;
 update public.umrah_pool_email_jobs set status=case when p_outcome='failed' and attempts<10 then 'pending' else p_outcome end,
  available_at=now()+least(3600,power(2,attempts)::int*30)*interval '1 second',
  sent_at=case when p_outcome='sent' then now() else null end,last_error=left(p_error,500)
 where id=p_id and claim_token=p_token and status='sending';
end $$;
revoke all on function public.finish_umrah_pool_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_umrah_pool_email(uuid,uuid,text,text) to service_role;
create function public.resend_umrah_pool_email(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.umrah_pool_requests;
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 select req.* into r from public.umrah_pool_requests req join public.umrah_pool_email_jobs j on j.request_id=req.id where j.id=p_id;
 if r.id is null then raise exception 'Notification not found.'; end if;
 update public.umrah_pool_email_jobs set status='pending',attempts=0,available_at=now(),claim_token=null,last_error=null where id=p_id and status in ('failed','pending');
 if not found then raise exception 'Only failed or pending notifications can be retried.'; end if;
 insert into public.umrah_pool_events(departure_id,request_id,event_key,kind,actor_id,processed_at) values(r.departure_id,r.id,gen_random_uuid()::text,'email_retry',auth.uid(),now());
end $$;
revoke all on function public.resend_umrah_pool_email(uuid) from public,anon;
grant execute on function public.resend_umrah_pool_email(uuid) to authenticated;
