alter table public.partner_application_drafts add column confirmed_fields jsonb;
-- Only the server marks a validated Continue submission as confirmed.
create function public.confirm_partner_application_draft(p_owner uuid,p_kind text,p_id uuid,p_step smallint,p_fields jsonb)
returns void language sql security definer set search_path=public as $$
 insert into partner_application_drafts(applicant_id,kind,application_id,step,fields,confirmed_fields)
 values(p_owner,p_kind,p_id,p_step,p_fields,p_fields)
 on conflict(applicant_id,kind,application_id,step) do update
 set fields=excluded.fields,confirmed_fields=excluded.fields,revision=partner_application_drafts.revision+1,saved_at=now();
$$;
revoke all on function public.confirm_partner_application_draft(uuid,text,uuid,smallint,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_partner_application_draft(uuid,text,uuid,smallint,jsonb) to service_role;
