-- Isolated empty PostgreSQL only: tests the actual migration, not application data.
\set ON_ERROR_STOP on
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end$$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create type visa_status as enum('draft','submitted','in_review','additional_info_required','ready_for_processing','processing','approved','rejected','issued','cancelled');
create table profiles(id uuid,full_name text,email text);
create table visa_types(id uuid,name text,status text,destination_country_code text,required_documents jsonb,application_sections jsonb default '[]',price numeric,processing_fee numeric,currency text,requires_appointment boolean default false,requires_biometrics boolean default false,requires_physical_passport boolean default false,passport_delivery_modes text[] default '{}',internal_sla_days integer default 2,updated_at timestamptz default now());
create table visa_applications(id uuid primary key,visa_type_id uuid,submitted_by uuid,applicant_profile_id uuid,agency_id uuid,status visa_status,applicant_type text,application_ref text,resolved_documents jsonb,traveler_details jsonb default '{}',contact_details jsonb default '{}',travel_details jsonb default '{}',workflow jsonb default '{}',partner_ref text,created_at timestamptz default now(),submitted_at timestamptz,price numeric,fee_amount numeric,currency text,current_step integer,resolved_price numeric,resolved_processing_fee numeric,resolved_eligibility_requirements text);
create table visa_members(id uuid primary key,application_id uuid,full_name text,is_primary boolean,sort_order integer,passport_expiry date,nationality text default 'SO',passport_number text default gen_random_uuid()::text);
create table visa_documents(id uuid primary key default gen_random_uuid(),application_id uuid,document_type text,member_id uuid,is_current boolean default true,review_status text default 'pending',request_id uuid,storage_path text,uploaded_by uuid,file_name text check(file_name<>'FAIL'),version integer default 1,supersedes_id uuid,file_size integer,content_type text);
create table visa_document_requests(id uuid,application_id uuid,title text,status text,requirement text,document_id uuid);
create table visa_case_ops(application_id uuid primary key,assigned_to uuid,priority text,sla_due_at timestamptz,updated_at timestamptz);
create table visa_case_events(application_id uuid,event_type text,to_stage visa_status,created_at timestamptz);
create table visa_appointments(application_id uuid,status text,scheduled_at timestamptz,attended boolean,confirmation_number text);
create table visa_processing_jobs(application_id uuid,status text,centre_status text,processing_stage text,lodgement_reference text);
create table visa_decisions(id uuid,application_id uuid,supersedes_id uuid,outcome text,recorded_at timestamptz);
create table visa_passports(application_id uuid,status text);
create schema storage; create table storage.objects(bucket_id text,name text);
create function visa_staff_can(text) returns boolean language sql stable as $$select current_setting('test.admin',true)='yes'$$;
create function is_agency_member(uuid) returns boolean language sql stable as $$select false$$;
create function _visa_trusted_writer(uuid) returns boolean language sql stable as $$select false$$;
create function _visa_is_case_party(visa_applications) returns boolean language sql stable as $$select ($1).submitted_by=auth.uid()$$;
create function visa_payment_state(uuid) returns text language sql stable as $$select 'paid'::text$$;
create function visa_case_attention(visa_applications) returns text language sql stable as $$select 'review'::text$$;
create function _visa_assert_uploaded(visa_applications,text) returns void language plpgsql as $$begin if not exists(select 1 from storage.objects where bucket_id='visa-documents' and name=$2) then raise exception 'upload not found'; end if; end$$;
create function _visa_create_passports(visa_applications) returns void language sql as $$select$$;
create function _visa_set_stage(p_application_id uuid,p_to visa_status,p_note text default null,p_permission text default null,p_customer_summary text default null,p_notify boolean default true,p_bypass_map boolean default false) returns visa_status language plpgsql as $$begin update visa_applications set status=p_to where id=p_application_id;return p_to;end$$;
create function _visa_log_event(p_application_id uuid,p_type text,p_summary text,p_customer_summary text default null,p_notify_customer boolean default false,p_notify_staff boolean default false,p_permission text default null,p_reason text default null,p_from visa_status default null,p_to visa_status default null,p_data jsonb default '{}',p_member uuid default null,p_actor_kind text default null) returns uuid language sql as $$select gen_random_uuid()$$;
\ir ../../../supabase/migrations/20261115000001_visa_traveller_documents.sql
create function resolve_visa_pricing(p_visa_type_id uuid,p_nationality_code text) returns table(price numeric,processing_fee numeric,required_documents jsonb,eligibility_requirements text) language sql stable as $$ select case when p_nationality_code='IN' then 80 else vt.price end,case when p_nationality_code='IN' then 7 else coalesce(vt.processing_fee,0) end, case when p_nationality_code='IN' then '[{"key":"permit","label":"Residence permit","required":true}]'::jsonb else vt.required_documents end,'Nationality requirements'::text from visa_types vt where id=p_visa_type_id $$;
\ir ../../../supabase/migrations/20261115000002_visa_traveller_nationality.sql
create function expect_failure(statement text,part text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then if position(part in sqlerrm)=0 then raise;end if;return;end;
 raise exception 'Expected failure: %',statement;end$$;
select set_config('test.user','00000000-0000-4000-8000-000000000001',true);select set_config('test.admin','yes',true);
insert into visa_types(id,name,status,destination_country_code,required_documents,price,processing_fee,currency) values('10000000-0000-4000-8000-000000000001','QA family visa','published','SA','[{"key":"passport","label":"Passport","required":true},{"key":"photo","label":"Photo","required":true},{"key":"bank","label":"Bank","required":false}]',50,5,'USD');
insert into visa_applications(id,visa_type_id,submitted_by,applicant_profile_id,status,applicant_type,application_ref,travel_details) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',auth.uid(),auth.uid(),'draft','family','QA-FAMILY','{"departure_date":"2027-01-10"}');
insert into visa_members(id,application_id,full_name,is_primary,sort_order,passport_expiry) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','QA Parent',true,0,'2030-01-01'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','QA Child One',false,1,'2030-01-01'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','QA Child Two',false,2,'2030-01-01');
do $$begin if (select count(*) from _visa_required_slots('20000000-0000-4000-8000-000000000001'))<>6 then raise exception 'Expected six required person-specific slots';end if;end$$;
-- Group requires the same per-person checklist; one-person billing cannot hide a party of three.
update visa_applications set applicant_type='group';
do $$begin if (select count(*) from _visa_required_slots('20000000-0000-4000-8000-000000000001'))<>6 then raise exception 'Group requirements differ from family';end if;end$$;
update visa_applications set applicant_type='single';
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000001')$q$,'exactly one traveller');
update visa_applications set applicant_type='family';
update visa_members set passport_expiry='2026-12-01' where sort_order=2;
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000001')$q$,'valid after departure');
update visa_members set passport_expiry='2030-01-01';
update visa_members set is_primary=false where sort_order=0;
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000001')$q$,'primary traveller');
update visa_members set is_primary=true where sort_order=0;
-- Historical shared files cover only the primary person.
insert into visa_documents(application_id,document_type,member_id,review_status) values('20000000-0000-4000-8000-000000000001','passport',null,'accepted'),('20000000-0000-4000-8000-000000000001','photo',null,'accepted');
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000001')$q$,'QA Child One');
select expect_failure($q$insert into visa_documents(application_id,document_type,member_id) values('20000000-0000-4000-8000-000000000001','passport','30000000-0000-4000-8000-000000000099')$q$,'Traveller does not belong');
insert into visa_documents(application_id,document_type,member_id,review_status) select application_id,t,id,'accepted' from visa_members cross join unnest(array['passport','photo']) t where not is_primary;
-- Draft replacement changes only the selected person's slot and keeps all other files.
insert into storage.objects values('visa-documents','20000000-0000-4000-8000-000000000001/draft.png');
select expect_failure($q$select visa_save_draft_document('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','photo','20000000-0000-4000-8000-000000000001/draft.png','FAIL',10,'image/png')$q$,'violates check constraint');
do $$begin if not exists(select 1 from visa_documents where member_id='30000000-0000-4000-8000-000000000002' and document_type='photo' and is_current) then raise exception 'Failed replacement lost original file';end if;end$$;
select visa_save_draft_document('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','photo','20000000-0000-4000-8000-000000000001/draft.png','replacement.png',10,'image/png');
update visa_documents set review_status='accepted' where is_current;
-- Rejected or superseded child proof never counts.
update visa_documents set review_status='rejected' where member_id='30000000-0000-4000-8000-000000000003' and document_type='photo';
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000001')$q$,'QA Child Two');
update visa_documents set review_status='accepted',is_current=false where member_id='30000000-0000-4000-8000-000000000003' and document_type='photo';
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000001')$q$,'QA Child Two');
update visa_documents set is_current=true where member_id='30000000-0000-4000-8000-000000000003' and document_type='photo';
-- Custom traveller file requirements repeat; application requirements stay shared.
update visa_types set application_sections='[{"key":"each","title":"Each","scope":"traveller","fields":[{"key":"proof","label":"Proof","type":"file","required":true}]},{"key":"shared","title":"Shared","scope":"application","fields":[{"key":"proof","label":"Proof","type":"file","required":true}]}]';
do $$begin if (select count(*) from _visa_required_slots('20000000-0000-4000-8000-000000000001'))<>10 then raise exception 'Custom section scope is wrong';end if;end$$;
update visa_types set application_sections='[]';
-- All six files permit one family submission with the correct three-person quote.
do $$declare result record;begin select * into result from submit_visa_application('20000000-0000-4000-8000-000000000001');if result.price<>150 or result.fee_amount<>15 then raise exception 'Wrong family quote';end if;end$$;
-- Recovery: a newly added person needs their own files; source documents remain intact.
insert into visa_members(id,application_id,full_name,is_primary,sort_order,passport_expiry) values('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','QA Added Traveller',false,3,'2030-01-01');
insert into storage.objects values('visa-documents','20000000-0000-4000-8000-000000000001/test.png');
select visa_upload_missing_document('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','passport','20000000-0000-4000-8000-000000000001/test.png','test.png',10,'image/png');
select expect_failure($q$select visa_upload_missing_document('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','passport','20000000-0000-4000-8000-000000000001/test.png','test.png',10,'image/png')$q$,'already exists');
select set_config('test.user','00000000-0000-4000-8000-000000000002',true);select set_config('test.admin','no',true);
select expect_failure($q$select visa_upload_missing_document('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','photo','20000000-0000-4000-8000-000000000001/test.png','test.png',10,'image/png')$q$,'not available');

select expect_failure($q$select visa_traveller_requirements('20000000-0000-4000-8000-000000000001')$q$,'Application not found');
insert into visa_applications(id,visa_type_id,submitted_by,applicant_profile_id,status,applicant_type,application_ref,travel_details) values('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',auth.uid(),auth.uid(),'draft','family','QA-MIXED','{"departure_date":"2027-01-10"}');
insert into visa_members(id,application_id,full_name,is_primary,sort_order,passport_expiry,nationality) values('30000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000002','Somali Parent',true,0,'2030-01-01','SO'),('30000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000002','Indian Spouse',false,1,'2030-01-01','IN');
do $$begin if not exists(select 1 from _visa_required_slots('20000000-0000-4000-8000-000000000002') where slot_label like 'Residence permit%Indian Spouse%') then raise exception 'Missing nationality-specific spouse document';end if;end$$;
insert into visa_documents(application_id,document_type,member_id,review_status) select m.application_id,t,m.id,'accepted' from visa_members m cross join unnest(array['passport','photo']) t where m.full_name='Somali Parent';
select expect_failure($q$select * from submit_visa_application('20000000-0000-4000-8000-000000000002')$q$,'Indian Spouse');
insert into visa_documents(application_id,document_type,member_id,review_status) values('20000000-0000-4000-8000-000000000002','permit','30000000-0000-4000-8000-000000000012','accepted');
do $$declare result record;begin select * into result from submit_visa_application('20000000-0000-4000-8000-000000000002');if result.price<>130 or result.fee_amount<>12 then raise exception 'Incorrect mixed-nationality total';end if;end$$;
update visa_types set price=999;
do $$begin if (visa_traveller_requirements('20000000-0000-4000-8000-000000000002')->'30000000-0000-4000-8000-000000000011'->>'price')::numeric<>50 then raise exception 'Submitted quote changed with catalog';end if;end$$;

rollback;
\echo 'PASS: per-traveller completeness, legacy primary-only ownership, direct submit guards, correct family pricing, additional uploads and isolation'
