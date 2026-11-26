create or replace function public.applicant_can_edit(p_status text,p_submitted_at timestamptz)
returns boolean language sql stable set search_path=public as $$
 select p_status='draft' and p_submitted_at is null;
$$;

-- USING checks the old row; WITH CHECK permits the one-way submission.
do $$
declare t text;
begin
 foreach t in array array['agency_applications','hotel_partner_applications','affiliate_applications','venue_partner_applications'] loop
  execute format('drop policy if exists %I on public.%I',t||': applicant edits own within edit window',t);
  execute format('create policy %I on public.%I for update to authenticated using(applicant_id=auth.uid() and public.applicant_can_edit(status::text,submitted_at)) with check(applicant_id=auth.uid() and ((status=''draft'' and submitted_at is null) or (status=''pending'' and submitted_at is not null)))',t||': applicant edits draft or submits',t);
 end loop;
end $$;

-- Covers security-definer document helpers as well as direct table updates.
create function public.guard_submitted_partner_application()
returns trigger language plpgsql set search_path=public as $$
begin
 if auth.uid()=old.applicant_id and not public.is_admin() then
  if old.status::text<>'draft' or old.submitted_at is not null then raise exception 'Submitted applications are read-only'; end if;
  if new.applicant_id<>old.applicant_id or new.status::text not in ('draft','pending')
    or (new.status::text='draft' and new.submitted_at is not null)
    or (new.status::text='pending' and new.submitted_at is null) then raise exception 'Invalid application transition'; end if;
 end if;
 return new;
end $$;
do $$
declare t text;
begin
 foreach t in array array['agency_applications','hotel_partner_applications','affiliate_applications','venue_partner_applications'] loop
  execute format('create trigger lock_submitted_application before update on public.%I for each row execute function public.guard_submitted_partner_application()',t);
 end loop;
end $$;

revoke execute on function public.resubmit_kyc_document(text,uuid,text,text,text,text,int,text) from public,anon,authenticated;

create function public.applicant_can_change_application_file(p_kind text,p_id text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare allowed boolean;
begin
 case p_kind
 when 'agency' then select applicant_can_edit(status::text,submitted_at) into allowed from agency_applications where id::text=p_id and applicant_id=auth.uid();
 when 'hotel_partner' then select applicant_can_edit(status::text,submitted_at) into allowed from hotel_partner_applications where id::text=p_id and applicant_id=auth.uid();
 when 'affiliate' then select applicant_can_edit(status::text,submitted_at) into allowed from affiliate_applications where id::text=p_id and applicant_id=auth.uid();
 when 'venue_partner' then select applicant_can_edit(status::text,submitted_at) into allowed from venue_partner_applications where id::text=p_id and applicant_id=auth.uid();
 else return false;
 end case;
 return coalesce(allowed,false);
end $$;
revoke all on function public.applicant_can_change_application_file(text,text) from public,anon;
grant execute on function public.applicant_can_change_application_file(text,text) to authenticated;

create policy "Submitted application files: no insert" on storage.objects as restrictive for insert to authenticated
with check(bucket_id not in ('kyc-documents','partner-logos') or public.is_admin() or public.applicant_can_change_application_file((storage.foldername(name))[1],(storage.foldername(name))[2]));
create policy "Submitted application files: no update" on storage.objects as restrictive for update to authenticated
using(bucket_id not in ('kyc-documents','partner-logos') or public.is_admin() or public.applicant_can_change_application_file((storage.foldername(name))[1],(storage.foldername(name))[2]))
with check(bucket_id not in ('kyc-documents','partner-logos') or public.is_admin() or public.applicant_can_change_application_file((storage.foldername(name))[1],(storage.foldername(name))[2]));
create policy "Submitted application files: no delete" on storage.objects as restrictive for delete to authenticated
using(bucket_id not in ('kyc-documents','partner-logos') or public.is_admin() or public.applicant_can_change_application_file((storage.foldername(name))[1],(storage.foldername(name))[2]));
