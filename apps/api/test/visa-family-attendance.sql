\set ON_ERROR_STOP on
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end$$;
create table visa_applications(id uuid primary key,status text,applicant_type text,workflow jsonb);
create table visa_members(id uuid primary key,application_id uuid);
create table visa_appointments(application_id uuid,member_id uuid,status text,biometrics_completed boolean);
create table visa_passports(application_id uuid,member_id uuid,status text);
create table visa_processing_jobs(application_id uuid,status text);
create function _visa_require(text) returns void language sql as $$select$$;
create function visa_payment_state(uuid) returns text language sql as $$select 'paid'::text$$;
create function _visa_customer_blockers(uuid) returns text language sql as $$select null::text$$;
create function visa_application_outstanding_items(uuid) returns text language sql as $$select null::text$$;
\ir ../../../supabase/migrations/20261115000004_visa_family_submission_checks.sql
insert into visa_applications values('10000000-0000-4000-8000-000000000001','ready_for_processing','family','{"requires_appointment":true,"requires_biometrics":true,"requires_physical_passport":true}');
insert into visa_members values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
insert into visa_appointments select application_id,id,'attended',id='20000000-0000-4000-8000-000000000001' from visa_members;
do $$declare app uuid:='10000000-0000-4000-8000-000000000001';begin
 if _visa_submission_blocker(app) not like 'biometrics%' then raise exception 'One person biometrics incorrectly covered group';end if;
 if (select ok from visa_case_readiness(app) where key='biometrics') then raise exception 'Readiness incorrectly marks family biometrics complete';end if;
 update visa_appointments set biometrics_completed=true;
 if _visa_submission_blocker(app) is null then raise exception 'Missing passport records were accepted';end if;
 insert into visa_passports select application_id,id,'with_sts' from visa_members;
 if _visa_submission_blocker(app) is not null then raise exception 'Complete family was blocked';end if;
 update visa_passports set status='lost' where member_id='20000000-0000-4000-8000-000000000002';
 if _visa_submission_blocker(app) is null then raise exception 'Lost passport accepted';end if;
 delete from visa_appointments;
 insert into visa_appointments values(app,null,'cancelled',true);
 if _visa_attendance_complete(app,true) then raise exception 'Cancelled appointment counted';end if;
 update visa_appointments set status='attended';
 if not _visa_attendance_complete(app,true) then raise exception 'Shared attended appointment was ignored';end if;
end$$;
rollback;
\echo PASS: per-traveller biometrics, shared appointments and missing/lost passports
