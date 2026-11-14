-- Visa follow-ups, run every 15 minutes by the API (VisaFollowUpService).
--
-- Applicant side, when a case waits on the applicant for documents:
--   7 days  -> reminder to the applicant (email + in-app);
--   14 days -> a case not yet filed is cancelled with a full refund
--              (_visa_refund_unfiled); a filed case is flagged to staff
--              instead, since the authority is already involved.
-- Staff side, while a case is with the authority:
--   no staff activity for 3 days -> "check the authority portal" reminder,
--   at most once every 3 days;
--   expected decision date passed -> flagged once as overdue.

alter table public.visa_case_ops
  add column customer_reminded_at timestamptz,
  add column check_reminded_at timestamptz,
  add column overdue_flagged_at timestamptz;

/** When the case last entered "waiting on the applicant". */
create or replace function public._visa_waiting_since(p_application_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(created_at) from public.visa_case_events
   where application_id = p_application_id and to_stage = 'additional_info_required';
$$;

revoke execute on function public._visa_waiting_since(uuid) from public, anon, authenticated;

create or replace function public.visa_run_follow_ups()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_since timestamptz;
  v_refund numeric;
  v_currency text;
  v_reminded integer := 0;
  v_cancelled integer := 0;
  v_checks integer := 0;
  v_overdue integer := 0;
  v_reason text;
begin
  -- 1) Waiting on the applicant.
  for r in
    select a.id, a.application_ref, a.submitted_by, a.applicant_profile_id, a.agency_id, o.customer_reminded_at
      from public.visa_applications a
      left join public.visa_case_ops o on o.application_id = a.id
     where a.status = 'additional_info_required'
  loop
    v_since := public._visa_waiting_since(r.id);
    continue when v_since is null;

    if v_since < now() - interval '14 days' then
      if public._visa_is_filed(r.id) then
        -- Filed: the authority holds the case; staff decide what happens.
        if r.customer_reminded_at is null or r.customer_reminded_at < now() - interval '7 days' then
          perform public._visa_log_event(
            r.id, 'followup.applicant_unresponsive',
            'Applicant has not provided the requested documents for 14 days', null,
            false, true, null, null, null, null, '{}'::jsonb, null, 'system'
          );
          update public.visa_case_ops set customer_reminded_at = now() where application_id = r.id;
        end if;
        continue;
      end if;

      v_reason := 'Requested documents not received within 14 days.';
      v_refund := public._visa_refund_unfiled(r.id, 'Visa application cancelled: ' || v_reason, null);
      select o.currency into v_currency
        from public.order_items oi join public.orders o on o.id = oi.order_id
       where oi.visa_application_id = r.id limit 1;
      -- Logged without the generic stage notification: the applicant gets
      -- one dedicated message (emailed by the notification outbox).
      perform public._visa_set_stage(r.id, 'cancelled', v_reason, null, null, false);
      insert into public.notifications (profile_id, type, title, body, data)
      select distinct p, 'visa_auto_cancelled', 'Visa application cancelled',
             r.application_ref || ' was cancelled. ' || v_reason
               || case when v_refund > 0
                       then ' A full refund of ' || coalesce(v_currency, 'USD') || ' ' || to_char(v_refund, 'FM999999990.00') || ' is on its way.'
                       else '' end,
             jsonb_build_object('applicationId', r.id, 'applicationRef', r.application_ref, 'agencyId', r.agency_id)
        from unnest(array[r.submitted_by, r.applicant_profile_id]) as p
       where p is not null;
      perform public._apply_order_cancellation(o.id, 'Visa application cancelled: ' || v_reason)
         from public.order_items oi
         join public.orders o on o.id = oi.order_id
        where oi.visa_application_id = r.id
          and o.status in ('pending_payment', 'held');
      v_cancelled := v_cancelled + 1;
      continue;
    end if;

    if v_since < now() - interval '7 days'
       and (r.customer_reminded_at is null or r.customer_reminded_at < v_since) then
      insert into public.notifications (profile_id, type, title, body, data)
      select distinct p, 'visa_documents_reminder', 'Documents still needed',
             r.application_ref || ' is waiting for your documents. Upload them within 7 days to keep the application open.',
             jsonb_build_object('applicationId', r.id, 'applicationRef', r.application_ref, 'agencyId', r.agency_id)
        from unnest(array[r.submitted_by, r.applicant_profile_id]) as p
       where p is not null;
      insert into public.visa_case_ops (application_id, customer_reminded_at)
      values (r.id, now())
      on conflict (application_id) do update set customer_reminded_at = now(), updated_at = now();
      perform public._visa_log_event(
        r.id, 'followup.applicant_reminded', 'Reminder sent: documents outstanding for 7 days', null,
        false, false, null, null, null, null, '{}'::jsonb, null, 'system'
      );
      v_reminded := v_reminded + 1;
    end if;
  end loop;

  -- 2) With the authority: regular status checks and the overdue flag.
  for r in
    select a.id, j.expected_decision_on, o.check_reminded_at, o.overdue_flagged_at,
           (select max(e.created_at) from public.visa_case_events e
             where e.application_id = a.id and e.actor_kind = 'staff') as last_staff_at
      from public.visa_applications a
      join public.visa_processing_jobs j on j.application_id = a.id and j.status = 'active'
      left join public.visa_case_ops o on o.application_id = a.id
     where a.status = 'processing'
  loop
    if r.expected_decision_on is not null and r.expected_decision_on < current_date and r.overdue_flagged_at is null then
      perform public._visa_log_event(
        r.id, 'followup.overdue',
        'Past the expected decision date (' || to_char(r.expected_decision_on, 'FMDD Mon YYYY') || ')', null,
        false, true, null, null, null, null, '{}'::jsonb, null, 'system'
      );
      insert into public.visa_case_ops (application_id, overdue_flagged_at)
      values (r.id, now())
      on conflict (application_id) do update set overdue_flagged_at = now(), updated_at = now();
      v_overdue := v_overdue + 1;
    end if;

    if coalesce(r.last_staff_at, '-infinity'::timestamptz) < now() - interval '3 days'
       and (r.check_reminded_at is null or r.check_reminded_at < now() - interval '3 days') then
      perform public._visa_log_event(
        r.id, 'followup.check_due', 'No status check in 3 days. Check the authority portal.', null,
        false, true, null, null, null, null, '{}'::jsonb, null, 'system'
      );
      insert into public.visa_case_ops (application_id, check_reminded_at)
      values (r.id, now())
      on conflict (application_id) do update set check_reminded_at = now(), updated_at = now();
      v_checks := v_checks + 1;
    end if;
  end loop;

  return jsonb_build_object('reminded', v_reminded, 'cancelled', v_cancelled, 'checks', v_checks, 'overdue', v_overdue);
end;
$$;

revoke execute on function public.visa_run_follow_ups() from public, anon, authenticated;
grant execute on function public.visa_run_follow_ups() to service_role;
