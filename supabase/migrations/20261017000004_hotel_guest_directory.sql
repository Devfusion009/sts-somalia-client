-- Phase 4: guest directory for a hotel.
--
-- Guests are not a table: a stay's guest is the customer account (online
-- bookings) or the lead name/phone typed at the desk (offline and agency
-- bookings, whose customer_id is the staff member who entered them, not the
-- guest). This function folds every booking of one hotel into one row per
-- guest. Online guests are keyed by account, the rest by phone, then by name.
-- Contact details from an account are only returned for online guests.

create or replace function public.hotel_guest_directory(p_hotel_id uuid)
returns table (
  guest_key text,
  full_name text,
  email text,
  phone text,
  channel text,
  stays integer,
  cancelled integer,
  no_shows integer,
  room_nights integer,
  total_spent numeric,
  currency text,
  first_stay date,
  last_stay date,
  next_arrival date,
  booking_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or p_hotel_id in (select public.my_operable_hotel_ids())) then
    raise exception 'not authorised';
  end if;

  return query
  with base as (
    select hb.id,
           hb.customer_id,
           hb.status,
           hb.check_in,
           hb.check_out,
           hb.num_rooms,
           hb.total_price,
           hb.currency,
           hb.created_at,
           hb.channel::text as channel_text,
           nullif(trim(hb.guest_details -> 0 ->> 'full_name'), '') as lead_name,
           nullif(regexp_replace(coalesce(hb.guest_details -> 0 ->> 'phone', ''), '[^0-9+]', '', 'g'), '') as lead_phone,
           (hb.source = 'online' and hb.channel::text = 'b2c') as is_account
      from public.hotel_bookings hb
     where hb.hotel_id = p_hotel_id
  ),
  keyed as (
    select b.*,
           case
             when b.is_account then 'c:' || b.customer_id::text
             when b.lead_phone is not null then 'p:' || b.lead_phone
             when b.lead_name is not null then 'n:' || lower(b.lead_name)
             else 'b:' || b.id::text
           end as gkey
      from base b
  )
  select k.gkey,
         coalesce(
           (array_agg(k.lead_name order by k.created_at desc) filter (where k.lead_name is not null))[1],
           max(p.full_name),
           'Guest'
         )::text,
         case when bool_or(k.is_account) then max(p.email::text) else null end,
         coalesce(
           case when bool_or(k.is_account) then max(p.phone) else null end,
           (array_agg(k.lead_phone order by k.created_at desc) filter (where k.lead_phone is not null))[1]
         )::text,
         case
           when bool_or(k.is_account) then 'online'
           when bool_or(k.channel_text = 'b2b') then 'agency'
           else 'offline'
         end,
         (count(*) filter (where k.status in ('confirmed', 'completed')))::integer,
         (count(*) filter (where k.status in ('cancelled', 'refunded')))::integer,
         (count(*) filter (where k.status = 'no_show'))::integer,
         coalesce(sum((k.check_out - k.check_in) * k.num_rooms) filter (where k.status in ('confirmed', 'completed')), 0)::integer,
         coalesce(sum(k.total_price) filter (where k.status in ('confirmed', 'completed')), 0)::numeric,
         max(k.currency)::text,
         min(k.check_in) filter (where k.status in ('confirmed', 'completed')),
         max(k.check_in) filter (where k.status in ('confirmed', 'completed') and k.check_in <= current_date),
         min(k.check_in) filter (where k.status in ('pending', 'confirmed') and k.check_in >= current_date),
         array_agg(k.id order by k.check_in desc)
    from keyed k
    left join public.profiles p on p.id = k.customer_id and k.is_account
   group by k.gkey
   order by max(k.check_in) desc;
end;
$$;

grant execute on function public.hotel_guest_directory(uuid) to authenticated;
