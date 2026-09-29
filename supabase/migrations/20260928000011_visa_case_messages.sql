-- Visa case management, milestone 5 of 5: applicant <-> STS messages.
--
-- A message thread is separate from internal notes (visa_processing_notes):
-- everything here is visible to the applicant, nothing in notes ever is.
-- Messages are append-only. Sending one notifies the other side through the
-- case event log (staff message → applicant; applicant message → the case
-- owner, or every platform admin when unassigned).

create table public.visa_case_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  author_id uuid default auth.uid(),
  author_kind text not null check (author_kind in ('staff', 'customer', 'agent')),
  author_name text,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp()
);

create index visa_case_messages_application_idx on public.visa_case_messages (application_id, created_at);

create trigger visa_case_messages_append_only
  before update or delete on public.visa_case_messages
  for each row execute function public.guard_visa_child_append_only();

alter table public.visa_case_messages enable row level security;

create policy "visa_case_messages: staff read"
  on public.visa_case_messages for select
  using ((select public.visa_staff_can('visa.applications.read')));
create policy "visa_case_messages: party read"
  on public.visa_case_messages for select
  using (
    exists (
      select 1 from public.visa_applications a
       where a.id = visa_case_messages.application_id
         and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
              or (a.agency_id is not null and public.is_agency_member(a.agency_id)))
    )
  );

revoke insert, update, delete, truncate on public.visa_case_messages from anon, authenticated;

create or replace function public.visa_send_message(p_application_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_body text := btrim(coalesce(p_body, ''));
  v_kind text;
  v_name text;
  v_id uuid;
  v_snippet text;
begin
  if length(v_body) = 0 then
    raise exception 'write a message';
  end if;
  if length(v_body) > 4000 then
    raise exception 'messages are limited to 4000 characters';
  end if;

  select * into app from public.visa_applications where id = p_application_id;
  if not found or app.status = 'draft' then
    raise exception 'visa application not found';
  end if;

  if public.visa_staff_can('visa.messages.send') then
    v_kind := 'staff';
  elsif public._visa_is_case_party(app) then
    v_kind := case when app.agency_id is not null and public.is_agency_member(app.agency_id) then 'agent' else 'customer' end;
  else
    raise exception 'visa application not found';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  insert into public.visa_case_messages (application_id, author_kind, author_name, body)
  values (app.id, v_kind, v_name, v_body)
  returning id into v_id;

  v_snippet := case when length(v_body) > 140 then left(v_body, 137) || '…' else v_body end;

  if v_kind = 'staff' then
    perform public._visa_log_event(
      app.id, 'message.sent', 'Message to applicant: ' || v_snippet,
      'New message from STS about ' || app.application_ref || ': ' || v_snippet,
      true, false, 'visa.messages.send',
      null, null, null, jsonb_build_object('messageId', v_id)
    );
  else
    perform public._visa_log_event(
      app.id, 'message.received', coalesce(v_name, 'Applicant') || ': ' || v_snippet,
      null, false, true, null,
      null, null, null, jsonb_build_object('messageId', v_id)
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.visa_send_message(uuid, text) from public, anon;
grant execute on function public.visa_send_message(uuid, text) to authenticated;

-- An unanswered applicant message is work for STS.
create or replace function public.visa_case_attention(app public.visa_applications)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when app.status = 'submitted'
         and public.visa_payment_state(app.id) in ('paid', 'partially_paid') then 'new'
    when app.status in ('in_review', 'ready_for_processing', 'processing', 'additional_info_required')
         and exists (
           select 1 from public.visa_appointments a
            where a.application_id = app.id and a.status = 'booked' and a.scheduled_at < now()
         ) then 'appointment_outcome'
    when (
      select m.author_kind from public.visa_case_messages m
       where m.application_id = app.id
       order by m.created_at desc limit 1
    ) in ('customer', 'agent') then 'message'
    when app.status = 'in_review' then 'review'
    when app.status = 'additional_info_required'
         and (
           exists (
             select 1 from public.visa_documents d
              where d.application_id = app.id and d.is_current and d.review_status = 'pending'
                and d.document_type not in ('visa_result', 'decision_letter', 'submission_receipt', 'passport_authorization')
           )
           or exists (
             select 1 from public.visa_document_requests r
              where r.application_id = app.id and r.status = 'uploaded'
           )
         ) then 'customer_replied'
    when app.status = 'ready_for_processing' then 'ready'
    when app.status = 'approved'
         and (
           (coalesce((app.workflow->>'requires_physical_passport')::boolean, false)
             and exists (select 1 from public.visa_passports p
                          where p.application_id = app.id and p.status not in ('delivered', 'collected')))
           or (not coalesce((app.workflow->>'requires_physical_passport')::boolean, false)
             and not exists (select 1 from public.visa_documents d
                              where d.application_id = app.id and d.document_type = 'visa_result' and d.is_current))
         ) then 'deliver'
    else null
  end;
$$;
