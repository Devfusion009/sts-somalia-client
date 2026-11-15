-- Reviewed cases enter scheduling without inventing an appointment or changing submission order.
create function public.admin_visa_appointment_handoffs(p_offset integer default 0, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 perform public._visa_require('visa.applications.read');
 return (
  with waiting as (
   select a.id,a.application_ref,a.traveler_details->>'full_name' applicant_name,
     v.name visa_name,v.destination_country_code,
     exists(select 1 from visa_appointments ap where ap.application_id=a.id and ap.status='booked') booked,
     a.submitted_at
   from visa_applications a join visa_types v on v.id=a.visa_type_id
   where a.status='ready_for_processing'
     and (coalesce((a.workflow->>'requires_appointment')::boolean,false) or coalesce((a.workflow->>'requires_biometrics')::boolean,false))
     and (not public._visa_attendance_complete(a.id,false)
       or (coalesce((a.workflow->>'requires_biometrics')::boolean,false) and not public._visa_attendance_complete(a.id,true)))
  )
  select jsonb_build_object('count',(select count(*) from waiting),'rows',coalesce((select jsonb_agg(row_to_json(pg)) from (
    select * from waiting order by submitted_at asc nulls last,id offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)
  ) pg),'[]'::jsonb))
 );
end $$;
revoke all on function public.admin_visa_appointment_handoffs(integer,integer) from public,anon;
grant execute on function public.admin_visa_appointment_handoffs(integer,integer) to authenticated;

create or replace function public.admin_nav_counts()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return jsonb_build_object(
    'queue',
      (select count(*) from public.hotel_bookings where status = 'waitlisted')
      + (select count(*) from public.hall_bookings where status = 'waitlisted')
      + (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'refunds',
      (select count(*) from public.agency_refund_requests where status = 'pending')
      + (select count(*) from public.booking_requests where status in ('requested', 'in_review', 'approved')),
    'visa',
      (select count(*) from public.visa_applications a
        where a.status in ('submitted','in_review','additional_info_required','ready_for_processing') and public.visa_case_attention(a) is not null
          and not (a.status='ready_for_processing' and (coalesce((a.workflow->>'requires_appointment')::boolean,false) or coalesce((a.workflow->>'requires_biometrics')::boolean,false)) and not public._visa_attendance_complete(a.id,coalesce((a.workflow->>'requires_biometrics')::boolean,false)))),
    'visa_appointments',
      (select count(*) from public.visa_applications a where a.status not in ('draft','issued','rejected','cancelled') and (
        exists(select 1 from public.visa_appointments ap where ap.application_id=a.id and ap.status='booked')
        or (a.status='ready_for_processing' and (coalesce((a.workflow->>'requires_appointment')::boolean,false) or coalesce((a.workflow->>'requires_biometrics')::boolean,false))
          and not public._visa_attendance_complete(a.id,coalesce((a.workflow->>'requires_biometrics')::boolean,false)))
      )),
    'umrah_requests',
      (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'partner_applications',
      (select count(*) from public.agency_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.hotel_partner_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.affiliate_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.venue_partner_applications where status in ('pending', 'under_review')),
    'markup_requests',
      (select count(*) from public.agency_markup_requests where status = 'pending'),
    'earnings_reviews',
      (select count(*) from public.agency_commission_entries where status = 'pending'),
    'payout_requests',
      (select count(*) from public.agency_payout_requests where status in ('pending', 'approved')),
    'topup_requests',
      (select count(*) from public.agency_topup_requests where status = 'pending' and rail = 'offline')
  );
end;
$function$;

-- Scheduling owns reviewed cases until attendance is complete. History remains searchable.
create or replace function public.visa_case_attention(app public.visa_applications)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when app.status = 'ready_for_processing'
      and (coalesce((app.workflow->>'requires_appointment')::boolean,false) or coalesce((app.workflow->>'requires_biometrics')::boolean,false))
      and not public._visa_attendance_complete(app.id,coalesce((app.workflow->>'requires_biometrics')::boolean,false)) then null
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

create or replace function public.visa_queue_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public._visa_require('visa.applications.read');
  select jsonb_build_object(
    'needs_action', count(*) filter (where q.attention is not null and q.status in ('submitted','in_review','additional_info_required','ready_for_processing')),
    'mine', count(*) filter (where q.assigned_to = auth.uid() and q.status not in ('approved', 'rejected', 'issued', 'cancelled')),
    'unassigned', count(*) filter (where q.assigned_to is null and q.status not in ('approved', 'rejected', 'issued', 'cancelled')),
    'sla_at_risk', count(*) filter (
      where q.sla_due_at < now() + interval '24 hours'
        and q.status in ('submitted', 'in_review', 'ready_for_processing')
        and q.payment_state in ('paid', 'partially_paid')),
    'payment_pending', count(*) filter (where q.status = 'submitted' and q.payment_state not in ('paid', 'partially_paid')),
    'new', count(*) filter (where q.status = 'submitted' and q.payment_state in ('paid', 'partially_paid')),
    'document_review', count(*) filter (where q.status = 'in_review'),
    'customer_action', count(*) filter (where q.status = 'additional_info_required'),
    'appointment_pending', count(*) filter (
      where q.requires_appointment and not coalesce(q.appointment_attended, false)
        and q.status in ('in_review', 'additional_info_required', 'ready_for_processing')),
    'ready_for_submission', count(*) filter (where q.status = 'ready_for_processing'),
    'processing', count(*) filter (where q.status = 'processing'),
    'approved', count(*) filter (where q.status = 'approved'),
    'refused', count(*) filter (where q.status = 'rejected'),
    'passport_return', count(*) filter (
      where q.requires_passport and q.status in ('approved', 'rejected', 'cancelled')
        and q.passports_outstanding > 0),
    'issued', count(*) filter (where q.status = 'issued'),
    'cancelled', count(*) filter (where q.status = 'cancelled'),
    'all', count(*)
  )
  into v
  from public.visa_case_queue q;
  return v;
end;
$$;
