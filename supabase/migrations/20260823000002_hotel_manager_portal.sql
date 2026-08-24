-- ============================================================================
-- Hotel manager portal groundwork.
--
-- 1) hotel_managers.permissions text[] replaces the two ad-hoc boolean
--    columns. Every new manager capability so far has meant a new column, a
--    new helper function, a new RPC signature (admin_add_hotel_manager
--    already had two live overloads) and an app-side form change. An array +
--    one generic helper ends that: a future permission is a new key in the
--    app registry (manager-permissions.ts) and, where it guards a table, one
--    policy calling hotel_manager_has_permission — no schema change.
--
-- 2) The blanket manager write access to hotel_rooms / hotel_room_inventory
--    becomes permission-gated ('rooms' / 'availability'), with plain reads
--    kept for every active manager. Backfill grants both to existing
--    managers so nobody loses access they had yesterday.
--
-- 3) admin_nav_counts() — one admin-gated round trip for the sidebar badge
--    counts (order queue, refunds, visa, private Umrah, partner
--    applications).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Permissions array
-- ----------------------------------------------------------------------------
alter table public.hotel_managers
  add column permissions text[] not null default '{}';

-- 'rooms' + 'availability' for everyone: managers had unconditional write
-- access to rooms and inventory before this migration.
update public.hotel_managers
   set permissions = array['rooms', 'availability']
       || case when can_manage_bookings then array['bookings'] else '{}'::text[] end
       || case when can_manage_photos then array['photos'] else '{}'::text[] end;

create index hotel_managers_permissions_idx on public.hotel_managers using gin (permissions);

create or replace function public.hotel_manager_has_permission(target_hotel_id uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_managers
    where hotel_id = target_hotel_id
      and profile_id = auth.uid()
      and status = 'active'
      and perm = any (permissions)
  );
$$;

-- Same names and signatures the existing policies already call — redefined
-- over the array so those policies (hotel_bookings status update, hotels
-- photo update, the six storage.objects photo/logo policies) keep working
-- without being touched.
create or replace function public.hotel_manager_can_manage_bookings(target_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.hotel_manager_has_permission(target_hotel_id, 'bookings');
$$;

create or replace function public.hotel_manager_can_manage_photos(target_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.hotel_manager_has_permission(target_hotel_id, 'photos');
$$;

alter table public.hotel_managers
  drop column can_manage_bookings,
  drop column can_manage_photos;

-- ----------------------------------------------------------------------------
-- 2) Room / inventory / profile / reviews policies
-- ----------------------------------------------------------------------------
drop policy "hotel_rooms: manager manages assigned hotel" on public.hotel_rooms;

create policy "hotel_rooms: manager reads assigned hotel"
  on public.hotel_rooms for select to authenticated
  using (public.is_hotel_manager(hotel_id));

create policy "hotel_rooms: manager writes when permitted"
  on public.hotel_rooms for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'rooms'))
  with check (public.hotel_manager_has_permission(hotel_id, 'rooms'));

drop policy "hotel_room_inventory: manager manages assigned hotel" on public.hotel_room_inventory;

create policy "hotel_room_inventory: manager reads assigned hotel"
  on public.hotel_room_inventory for select to authenticated
  using (exists (
    select 1 from public.hotel_rooms r
    where r.id = hotel_room_inventory.room_id and public.is_hotel_manager(r.hotel_id)
  ));

create policy "hotel_room_inventory: manager writes when permitted"
  on public.hotel_room_inventory for all to authenticated
  using (exists (
    select 1 from public.hotel_rooms r
    where r.id = hotel_room_inventory.room_id and public.hotel_manager_has_permission(r.hotel_id, 'availability')
  ))
  with check (exists (
    select 1 from public.hotel_rooms r
    where r.id = hotel_room_inventory.room_id and public.hotel_manager_has_permission(r.hotel_id, 'availability')
  ));

-- Row-level only, like the photos policy above it — which operational
-- columns a profile-permitted manager may touch (description, address,
-- contact details; never name/slug/status/partner_id) is enforced by the
-- manager server action, the only writer on this path.
create policy "hotels: manager updates profile when permitted"
  on public.hotels for update to authenticated
  using (public.hotel_manager_has_permission(id, 'profile'))
  with check (public.hotel_manager_has_permission(id, 'profile'));

-- Managers see every review on their hotel, hidden ones included — the
-- public policy only exposes published reviews of published properties.
create policy "property_reviews: manager reads assigned hotel"
  on public.property_reviews for select to authenticated
  using (hotel_id is not null and public.is_hotel_manager(hotel_id));

-- ----------------------------------------------------------------------------
-- 3) Admin RPCs over the array (both old overloads dropped — the pair was
--    already an overload trap for PostgREST)
-- ----------------------------------------------------------------------------
drop function public.admin_add_hotel_manager(uuid, extensions.citext);
drop function public.admin_add_hotel_manager(uuid, extensions.citext, boolean, boolean);
drop function public.admin_update_hotel_manager_permissions(uuid, boolean, boolean);

create function public.admin_add_hotel_manager(
  p_hotel_id uuid,
  p_email extensions.citext,
  p_permissions text[] default '{}'
)
returns public.hotel_managers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  target_role public.app_role;
  new_row public.hotel_managers;
begin
  if not public.is_admin() then
    raise exception 'only admins can assign hotel managers';
  end if;

  select id, role into target_profile_id, target_role from public.profiles where email = p_email;
  if target_profile_id is null then
    raise exception 'No STS account found with that email.';
  end if;

  insert into public.hotel_managers (hotel_id, profile_id, created_by, permissions)
  values (p_hotel_id, target_profile_id, auth.uid(), p_permissions)
  returning * into new_row;

  if target_role = 'customer' then
    perform public.promote_user_role(target_profile_id, 'hotel_manager');
  end if;

  return new_row;
end;
$$;

create function public.admin_update_hotel_manager_permissions(
  p_manager_id uuid,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can change hotel manager permissions';
  end if;

  update public.hotel_managers set permissions = p_permissions where id = p_manager_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Sidebar badge counts — the actionable queues, one round trip
-- ----------------------------------------------------------------------------
create function public.admin_nav_counts()
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
      (select count(*) from public.agency_applications where status = 'pending')
      + (select count(*) from public.hotel_partner_applications where status = 'pending')
      + (select count(*) from public.affiliate_applications where status = 'pending')
      + (select count(*) from public.venue_partner_applications where status = 'pending')
  );
end;
$$;
