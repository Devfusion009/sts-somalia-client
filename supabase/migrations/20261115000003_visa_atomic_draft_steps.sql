-- Keep multi-row wizard saves atomic and reject stale tabs before any write.
create or replace function public.visa_save_draft_step(p_application_id uuid,p_expected_updated_at timestamptz,p_step text,p_values jsonb,p_member_answers jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare app public.visa_applications; primary_id uuid; member record;
begin
 select * into app from visa_applications where id=p_application_id for update;
 if not found or app.submitted_by is distinct from auth.uid() or app.status<>'draft' then raise exception 'This application can no longer be edited.'; end if;
 if p_expected_updated_at is null or app.updated_at is distinct from p_expected_updated_at then raise exception 'This application changed in another tab. Refresh before saving.'; end if;
 if p_step='personal' then
   if coalesce(btrim(p_values->>'full_name'),'')='' or coalesce(btrim(p_values->>'passport_number'),'')='' or coalesce(p_values->>'nationality','')='' or coalesce(p_values->>'email','')='' or coalesce(p_values->>'mobile','')='' then raise exception 'Complete the required personal information.'; end if;
   if (p_values->>'date_of_birth')::date>current_date or (p_values->>'passport_expiry')::date<=current_date then raise exception 'Check the birth and passport expiry dates.'; end if;
   if exists(select 1 from visa_members where application_id=app.id and not is_primary and nationality=p_values->>'nationality' and upper(regexp_replace(passport_number,'\s','','g'))=upper(regexp_replace(p_values->>'passport_number','\s','','g'))) then raise exception 'This passport is already assigned to another traveller.'; end if;
   select id into primary_id from visa_members where application_id=app.id and is_primary;
   if primary_id is null then
     insert into visa_members(application_id,is_primary,full_name,relationship,date_of_birth,nationality,passport_number,passport_expiry,sort_order)
     values(app.id,true,p_values->>'full_name','self',(p_values->>'date_of_birth')::date,p_values->>'nationality',p_values->>'passport_number',(p_values->>'passport_expiry')::date,-1);
   else
     update visa_members set full_name=p_values->>'full_name',date_of_birth=(p_values->>'date_of_birth')::date,nationality=p_values->>'nationality',passport_number=p_values->>'passport_number',passport_expiry=(p_values->>'passport_expiry')::date where id=primary_id;
   end if;
   update visa_applications set traveler_details=p_values-ARRAY['email','mobile'],contact_details=jsonb_build_object('email',p_values->>'email','mobile',p_values->>'mobile'),current_step=greatest(current_step,3) where id=app.id;
 elsif p_step='travel' then
   if (p_values->>'arrival_date')::date<current_date or (p_values->>'departure_date')::date<(p_values->>'arrival_date')::date or coalesce(btrim(p_values->>'purpose'),'')='' or coalesce(btrim(p_values->>'address'),'')='' then raise exception 'Check the travel dates, purpose and address.'; end if;
   if exists(select 1 from visa_members where application_id=app.id and (passport_expiry is null or passport_expiry<=(p_values->>'departure_date')::date)) then raise exception 'Every traveller passport must be valid after departure.'; end if;
   for member in select id from visa_members where application_id=app.id loop
     if p_member_answers ? member.id::text then update visa_members set details=coalesce(details,'{}')||jsonb_build_object('answers',p_member_answers->member.id::text) where id=member.id; end if;
   end loop;
   update visa_applications set travel_details=p_values-'custom_answers',custom_answers=coalesce(p_values->'custom_answers','{}'),current_step=greatest(current_step,4) where id=app.id;
 else raise exception 'Unknown application step.'; end if;
end; $$;
revoke all on function public.visa_save_draft_step(uuid,timestamptz,text,jsonb,jsonb) from public,anon;
grant execute on function public.visa_save_draft_step(uuid,timestamptz,text,jsonb,jsonb) to authenticated;

-- Child edits invalidate a wizard page held open in another tab too.
create or replace function public.visa_touch_draft_parent()
returns trigger language plpgsql security definer set search_path=public as $$
declare app_id uuid;
begin
 if tg_op='DELETE' then app_id:=old.application_id; else app_id:=new.application_id; end if;
 update visa_applications set updated_at=clock_timestamp() where id=app_id and status='draft';
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.visa_touch_draft_parent() from public,anon,authenticated;
create trigger visa_member_touch_draft after insert or update or delete on public.visa_members for each row execute function public.visa_touch_draft_parent();
create trigger visa_document_touch_draft after insert or update or delete on public.visa_documents for each row execute function public.visa_touch_draft_parent();
