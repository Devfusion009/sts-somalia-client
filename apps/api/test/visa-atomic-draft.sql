\set ON_ERROR_STOP on
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end$$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create table visa_applications(id uuid primary key,submitted_by uuid,status text,updated_at timestamptz default clock_timestamp(),traveler_details jsonb,contact_details jsonb,travel_details jsonb,custom_answers jsonb check(custom_answers->>'fail' is distinct from 'yes'),current_step int default 2);
create table visa_members(id uuid primary key default gen_random_uuid(),application_id uuid,is_primary boolean,full_name text,relationship text,date_of_birth date,nationality text,passport_number text,passport_expiry date,sort_order int,details jsonb default '{}');
create table visa_documents(id uuid,application_id uuid);
\ir ../../../supabase/migrations/20261115000003_visa_atomic_draft_steps.sql
select set_config('test.user','00000000-0000-4000-8000-000000000001',true);
insert into visa_applications(id,submitted_by,status) values('10000000-0000-4000-8000-000000000001',auth.uid(),'draft');
do $$declare app uuid:='10000000-0000-4000-8000-000000000001';version timestamptz;v jsonb:='{"full_name":"QA Atomic","date_of_birth":"1990-01-01","gender":"male","nationality":"SO","passport_number":"TEST","passport_expiry":"2099-01-01","email":"qa@example.test","mobile":"+252611444421"}';m uuid;
begin
 select updated_at into version from visa_applications where id=app;
 perform visa_save_draft_step(app,version,'personal',v);
 if not exists(select 1 from visa_members where application_id=app and is_primary and full_name='QA Atomic') then raise exception 'Primary save missing';end if;
 begin perform visa_save_draft_step(app,version,'personal',v||'{"full_name":"Stale tab"}');raise exception 'Stale tab accepted';exception when others then if position('another tab' in sqlerrm)=0 then raise;end if;end;
 select id into m from visa_members where application_id=app;
 select updated_at into version from visa_applications where id=app;
 begin perform visa_save_draft_step(app,version,'travel','{"arrival_date":"2090-01-01","departure_date":"2090-01-05","purpose":"tourism","address":"QA","custom_answers":{"fail":"yes"}}',jsonb_build_object(m::text,'{"answer":"new"}'::jsonb));raise exception 'Expected failed app save';exception when check_violation then null;end;
 if exists(select 1 from visa_members where details ? 'answers') or exists(select 1 from visa_applications where current_step=4) then raise exception 'Partial data committed';end if;
 select updated_at into version from visa_applications where id=app;
 insert into visa_documents values(gen_random_uuid(),app);
 begin perform visa_save_draft_step(app,version,'personal',v);raise exception 'Child mutation did not invalidate draft';exception when others then if position('another tab' in sqlerrm)=0 then raise;end if;end;
 select updated_at into version from visa_applications where id=app;
 perform visa_save_draft_step(app,version,'travel','{"arrival_date":"2090-01-01","departure_date":"2090-01-05","purpose":"tourism","address":"QA","custom_answers":{}}',jsonb_build_object(m::text,'{"answer":"saved"}'::jsonb));
 if not exists(select 1 from visa_members where details->'answers'->>'answer'='saved') or not exists(select 1 from visa_applications where current_step=4) then raise exception 'Atomic travel save missing';end if;
 perform set_config('test.user','00000000-0000-4000-8000-000000000002',true);
 select updated_at into version from visa_applications where id=app;
 begin perform visa_save_draft_step(app,version,'personal',v);raise exception 'Other customer accepted';exception when others then if position('no longer be edited' in sqlerrm)=0 then raise;end if;end;
end$$;
rollback;
\echo PASS: atomic rollback, stale tabs, child edits and ownership
