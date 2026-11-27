create table public.partner_application_drafts (
 applicant_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('agency','hotel_partner','affiliate','venue_partner')),
 application_id uuid not null,
 step smallint not null check(step between 1 and 4),
 fields jsonb not null check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=100000),
 revision bigint not null default 1,
 saved_at timestamptz not null default now(),
 primary key(applicant_id,kind,application_id,step)
);
alter table public.partner_application_drafts enable row level security;
grant select on public.partner_application_drafts to authenticated;
revoke insert,update,delete on public.partner_application_drafts from anon,authenticated;
create policy "Applicants read their drafts" on public.partner_application_drafts for select to authenticated using(applicant_id=auth.uid());

-- A partial draft never advances validated wizard progress or changes the
-- submitted application. Concurrent devices must reconcile before overwriting.
create function public.save_partner_application_draft(p_kind text,p_id uuid,p_step smallint,p_fields jsonb,p_revision bigint)
returns bigint language plpgsql security definer set search_path=public as $$
declare owner uuid:=auth.uid(); editable boolean; new_revision bigint;
begin
 if owner is null then raise exception 'Sign in required'; end if;
 case p_kind
 when 'agency' then select applicant_can_edit(status::text,submitted_at) into editable from agency_applications where id=p_id and applicant_id=owner;
 when 'hotel_partner' then select applicant_can_edit(status::text,submitted_at) into editable from hotel_partner_applications where id=p_id and applicant_id=owner;
 when 'affiliate' then select applicant_can_edit(status::text,submitted_at) into editable from affiliate_applications where id=p_id and applicant_id=owner;
 when 'venue_partner' then select applicant_can_edit(status::text,submitted_at) into editable from venue_partner_applications where id=p_id and applicant_id=owner;
 else raise exception 'Invalid application';
 end case;
 if editable is distinct from true or (p_kind='affiliate' and p_step=4) then raise exception 'Application cannot be edited'; end if;
 insert into partner_application_drafts(applicant_id,kind,application_id,step,fields,revision) values(owner,p_kind,p_id,p_step,p_fields,1)
 on conflict(applicant_id,kind,application_id,step) do update set fields=excluded.fields,revision=partner_application_drafts.revision+1,saved_at=now()
 where partner_application_drafts.revision=p_revision
 returning revision into new_revision;
 if new_revision is null then raise exception 'Draft changed on another device' using errcode='40001'; end if;
 return new_revision;
end $$;
revoke all on function public.save_partner_application_draft(text,uuid,smallint,jsonb,bigint) from public,anon;
grant execute on function public.save_partner_application_draft(text,uuid,smallint,jsonb,bigint) to authenticated;
