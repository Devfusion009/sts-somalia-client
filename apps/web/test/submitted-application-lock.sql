\set ON_ERROR_STOP on
begin;
do $$
declare actor uuid; app uuid; t text; k text; n integer;
begin
 select id into actor from profiles where role='customer' and not is_platform_admin limit 1;
 if actor is null then raise exception 'Local customer required'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 foreach k in array array['agency','hotel_partner','affiliate','venue_partner'] loop
  t:=public.partner_application_table(k); app:=gen_random_uuid();
  if k='agency' then insert into agency_applications(id,applicant_id,agency_name,status) values(app,actor,'Lock test','draft');
  elsif k='affiliate' then insert into affiliate_applications(id,applicant_id,status) values(app,actor,'draft');
  else execute format('insert into %I(id,applicant_id,business_name,status) values($1,$2,''Lock test'',''draft'')',t) using app,actor;
  end if;
  execute 'set local role authenticated';
  execute format('update %I set business_details='' {"test":"draft"}''::jsonb where id=$1',t) using app;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Draft edit blocked for %',k; end if;
  execute format('update %I set status=''pending'',submitted_at=now() where id=$1',t) using app;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Submission blocked for %',k; end if;
  execute format('update %I set business_details=''{"test":"tampered"}''::jsonb where id=$1',t) using app;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Submitted edit allowed for %',k; end if;
  execute format('update %I set status=''draft'',submitted_at=null where id=$1',t) using app;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Submitted application reopened for %',k; end if;
  if public.applicant_can_change_application_file(k,app::text) then raise exception 'Submitted file write allowed'; end if;
  execute 'reset role';
  -- STS can still review; requesting more information does not unlock edits.
  perform set_config('request.jwt.claim.sub','',true);
  execute format('update %I set status=''more_info_requested'' where id=$1',t) using app;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  execute format('update %I set business_details=''{"test":"tampered"}''::jsonb where id=$1',t) using app;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'More-info state unlocked %',k; end if;
  execute 'reset role';
 end loop;
 if has_function_privilege('authenticated','resubmit_kyc_document(text,uuid,text,text,text,text,int,text)','execute') then raise exception 'Document bypass still available'; end if;
end $$;
rollback;
