-- Isolated empty PostgreSQL only. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
create function _visa_require(text) returns void language plpgsql as $$ begin if not is_admin() then raise exception 'not authorised'; end if; end $$;
create table visa_types(id uuid,name text,destination_country_code text);
create table visa_applications(id uuid,application_ref text,traveler_details jsonb,visa_type_id uuid,status text,workflow jsonb,submitted_at timestamptz);
create table visa_members(id uuid,application_id uuid);
create table visa_appointments(application_id uuid,member_id uuid,status text,biometrics_completed boolean,scheduled_at timestamptz);
create function visa_payment_state(uuid) returns text language sql stable as $$ select 'paid'::text $$;
create table visa_case_messages(application_id uuid,author_kind text,created_at timestamptz);
create table visa_documents(application_id uuid,is_current boolean,review_status text,document_type text);
create table visa_document_requests(application_id uuid,status text);
create table visa_passports(application_id uuid,status text);
create table hotel_bookings(status text);create table hall_bookings(status text);create table umrah_bookings(booking_kind text,status text);
create table agency_refund_requests(status text);create table booking_requests(status text);
create table agency_applications(status text);create table hotel_partner_applications(status text);create table affiliate_applications(status text);create table venue_partner_applications(status text);create table agency_markup_requests(status text);create table agency_commission_entries(status text);create table agency_payout_requests(status text);create table agency_topup_requests(status text,rail text);
-- Attendance and biometrics are per traveller, or an explicitly shared appointment.
create or replace function public._visa_attendance_complete(p_application_id uuid,p_biometrics boolean)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from visa_appointments a where a.application_id=p_application_id and a.member_id is null and a.status='attended' and (not p_biometrics or a.biometrics_completed))
 or (exists(select 1 from visa_members where application_id=p_application_id) and not exists(select 1 from visa_members m where m.application_id=p_application_id and not exists(select 1 from visa_appointments a where a.application_id=p_application_id and a.member_id=m.id and a.status='attended' and (not p_biometrics or a.biometrics_completed))));
$$;
revoke all on function public._visa_attendance_complete(uuid,boolean) from public,anon,authenticated;


\ir ../../../supabase/migrations/20261115000006_visa_appointment_handoffs.sql
create view visa_case_queue as select a.id,a.status,visa_case_attention(a) attention,
 null::uuid assigned_to,null::timestamptz sla_due_at,'paid'::text payment_state,
 coalesce((a.workflow->>'requires_appointment')::boolean,false) requires_appointment,
 _visa_attendance_complete(a.id,false) appointment_attended,false requires_passport,0 passports_outstanding
 from visa_applications a;
select set_config('test.admin','yes',true);
insert into visa_types values('90000000-0000-4000-8000-000000000001','QA Visa','KE');
insert into visa_applications select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'QA-'||i,'{"full_name":"QA Applicant"}','90000000-0000-4000-8000-000000000001',case i when 3 then 'processing' when 4 then 'issued' when 5 then 'in_review' else 'ready_for_processing' end,case i when 2 then '{}'::jsonb when 6 then '{"requires_biometrics":true}'::jsonb else '{"requires_appointment":true}'::jsonb end,now() from generate_series(1,6)i;
insert into visa_members select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001' from generate_series(1,2)i;
insert into visa_members values('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006');
insert into visa_appointments(application_id,member_id,status,biometrics_completed) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','attended',true),('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','booked',false),('10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006','attended',false);
do $$ declare q jsonb; begin
 q:=admin_visa_appointment_handoffs(0,1);
 if (q->>'count')::int<>2 or jsonb_array_length(q->'rows')<>1 then raise exception 'Count must be exact despite preview pagination'; end if;
 if (admin_nav_counts()->>'visa_appointments')::int<>2 then raise exception 'Missing appointment sidebar work'; end if;
 if (visa_queue_counts()->>'needs_action')::int<>2 then raise exception 'Scheduling or completed cases still in active review queue'; end if;
 if (admin_nav_counts()->>'visa')::int<>2 then raise exception 'Finished or handed off work still in review sidebar'; end if;
end $$;
update visa_appointments set status='attended' where status='booked';
do $$ begin if (admin_visa_appointment_handoffs()->>'count')::int<>1 then raise exception 'Family attendance handoff did not clear'; end if;end $$;
update visa_appointments set biometrics_completed=true;
do $$ begin if (admin_visa_appointment_handoffs()->>'count')::int<>0 then raise exception 'Biometrics handoff did not clear'; end if;end $$;
select set_config('test.admin','no',true);
do $$ begin begin perform admin_visa_appointment_handoffs();raise exception 'Expected denial';exception when raise_exception then if sqlerrm<>'not authorised' then raise;end if;end;end $$;
rollback;
\echo 'PASS: scheduling handoff, family attendance, biometrics, pagination, closed-stage filtering, sidebar counts and staff gate'
