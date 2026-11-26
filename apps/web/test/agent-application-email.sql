-- Run only in an empty, isolated PostgreSQL test database.
\set ON_ERROR_STOP on
begin;
create table public.agency_applications(id int primary key,status text,business_details jsonb);
\ir ../../../supabase/migrations/20261126000004_require_agent_application_email.sql
insert into agency_applications values(1,'draft','{}');
do $$
declare address text;
begin
 foreach address in array array['',' ','invalid','name@','name@example','name @example.com',repeat('a',250)||'@example.com'] loop
  begin
   update agency_applications set status='pending',business_details=jsonb_build_object('contactEmail',address,'businessEmail','office@example.test') where id=1;
   raise exception 'Invalid contact email accepted';
  exception when check_violation then null; end;
 end loop;
 begin
  update agency_applications set status='pending',business_details='{"contactEmail":"agent@example.test","businessEmail":" "}' where id=1;
  raise exception 'Missing business email accepted';
 exception when check_violation then null; end;
 update agency_applications set status='pending',business_details='{"contactEmail":"agent@example.test","businessEmail":"office@example.test"}' where id=1;
 begin
  update agency_applications set business_details=business_details-'contactEmail' where id=1;
  raise exception 'Submitted email removed';
 exception when check_violation then null; end;
 update agency_applications set status='under_review' where id=1;
end $$;
rollback;
