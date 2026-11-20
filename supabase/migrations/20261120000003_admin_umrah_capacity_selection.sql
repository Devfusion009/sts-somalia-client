-- Read only the departures displayed by Umrah Orders. Never sweep expired
-- checkouts during this admin read; the scheduled worker owns expiration.
create function public.admin_umrah_capacity_for_departures(p_departure_ids uuid[])
returns table (
  package_id uuid,
  departure_id uuid,
  total_seats integer,
  offline_seats integer,
  confirmed_seats bigint,
  held_seats bigint,
  formation_status text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if coalesce(cardinality(p_departure_ids), 0) > 50 then raise exception 'Select at most 50 departures.'; end if;
  return query
    select d.package_id, d.id, d.total_seats, d.offline_seats,
      case when d.booking_mode = 'request_then_pay' then requests.paid_places else bookings.confirmed_places end,
      case when d.booking_mode = 'request_then_pay' then greatest(d.booked_seats::bigint - requests.paid_places, 0) else bookings.pending_places end,
      d.formation_status::text
    from public.umrah_package_departures d
    left join lateral (
      select coalesce(sum(r.num_pilgrims) filter (where r.status = 'paid'), 0)::bigint as paid_places
      from public.umrah_pool_requests r where r.departure_id = d.id
    ) requests on true
    left join lateral (
      select coalesce(sum(b.num_pilgrims) filter (where b.status in ('confirmed','completed','no_show')), 0)::bigint as confirmed_places,
             coalesce(sum(b.num_pilgrims) filter (where b.status = 'pending'), 0)::bigint as pending_places
      from public.umrah_bookings b where b.departure_id = d.id
    ) bookings on true
    where d.id = any(p_departure_ids);
end $$;
revoke all on function public.admin_umrah_capacity_for_departures(uuid[]) from public, anon;
grant execute on function public.admin_umrah_capacity_for_departures(uuid[]) to authenticated;
