\set ON_ERROR_STOP on
begin;
do $$
declare owner uuid; other_user uuid; app uuid:=gen_random_uuid(); rev bigint;
begin
 select id into owner from profiles limit 1;
 select id into other_user from profiles where id<>owner limit 1;
 if owner is null or other_user is null then raise exception 'Local test profiles required'; end if;
 insert into agency_applications(id,applicant_id,agency_name,status) values(app,owner,'Draft test','draft');
 perform set_config('request.jwt.claim.sub',owner::text,true);
 rev:=save_partner_application_draft('agency',app,2::smallint,'{"contactFullName":"Unfinished"}',0);
 if rev<>1 then raise exception 'First revision incorrect'; end if;
 rev:=save_partner_application_draft('agency',app,2::smallint,'{"contactFullName":"Updated","contactEmail":""}',1);
 if rev<>2 then raise exception 'Update failed'; end if;
 if (select business_details from agency_applications where id=app)<>'{}'::jsonb then raise exception 'Draft advanced validated application'; end if;
 begin
  perform save_partner_application_draft('agency',app,2::smallint,'{"contactFullName":"Stale"}',1);
  raise exception 'Stale overwrite accepted';
 exception when serialization_failure then null; end;
 perform confirm_partner_application_draft(owner,'agency',app,2::smallint,'{"contactFullName":"Updated","contactEmail":""}');
 if exists(select 1 from partner_application_drafts where application_id=app and fields is distinct from confirmed_fields) then raise exception 'Validated draft not confirmed'; end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from partner_application_drafts where application_id=app) then raise exception 'Other account can read draft'; end if;
 execute 'reset role';
 begin
  perform save_partner_application_draft('agency',app,2::smallint,'{"contactFullName":"Attacker"}',2);
  raise exception 'Other account wrote draft';
 exception when raise_exception then if sqlerrm<>'Application cannot be edited' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform set_config('request.jwt.claim.sub','',true);
 update agency_applications set status='approved' where id=app;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 begin
  perform save_partner_application_draft('agency',app,2::smallint,'{}',2);
  raise exception 'Approved application edited';
 exception when raise_exception then if sqlerrm<>'Application cannot be edited' then raise; end if; end;
 if has_table_privilege('authenticated','partner_application_drafts','update') then raise exception 'Direct updates permitted'; end if;
 if has_function_privilege('anon','save_partner_application_draft(text,uuid,smallint,jsonb,bigint)','execute') then raise exception 'Anonymous saves permitted'; end if;
end $$;
rollback;
