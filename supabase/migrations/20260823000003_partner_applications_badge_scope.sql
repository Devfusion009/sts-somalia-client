-- admin_nav_counts()'s "partner_applications" count only counted status =
-- 'pending' (brand new, unopened). Every other bucket in this function
-- counts everything still "waiting on staff" (queue counts pending AND
-- waitlisted bookings, for example) — an application an admin has already
-- opened but not yet approved/rejected (under_review) is exactly that: it
-- silently dropped off the sidebar badge the moment anyone viewed it, even
-- though it still needs a decision. more_info_requested is deliberately
-- excluded — the ball is with the applicant there, not staff.
create or replace function public.admin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return jsonb_build_object(
    'queue',
      (select count(*) from public.hotel_bookings where status in ('pending', 'waitlisted'))
      + (select count(*) from public.hall_bookings where status = 'pending')
      + (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'refunds',
      (select count(*) from public.agency_refund_requests where status = 'pending'),
    'visa',
      (select count(*) from public.visa_applications where status = 'submitted'),
    'umrah_requests',
      (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'partner_applications',
      (select count(*) from public.agency_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.hotel_partner_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.affiliate_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.venue_partner_applications where status in ('pending', 'under_review'))
  );
end;
$$;
