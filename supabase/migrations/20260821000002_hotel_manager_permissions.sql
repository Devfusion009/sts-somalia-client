-- ============================================================================
-- Per-manager permissions. hotel_managers previously granted one fixed
-- bundle to everyone: rooms + availability (via is_hotel_manager, still
-- unconditional — that's the reason a manager exists at all, an admin
-- wouldn't assign one otherwise) plus, until now, bookings implicitly too.
-- Admin asked for booking control and photo uploads to be things they grant
-- per manager, not baked in — so those two become opt-in flags, defaulting
-- to off, checked in RLS itself (not just hidden in the UI) so a manager
-- without the flag can't reach the write path by any client.
-- ============================================================================

alter table public.hotel_managers
  add column can_manage_bookings boolean not null default false,
  add column can_manage_photos boolean not null default false;

create or replace function public.hotel_manager_can_manage_bookings(target_hotel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_managers
    where hotel_id = target_hotel_id
      and profile_id = auth.uid()
      and status = 'active'
      and can_manage_bookings
  );
$$;

create or replace function public.hotel_manager_can_manage_photos(target_hotel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_managers
    where hotel_id = target_hotel_id
      and profile_id = auth.uid()
      and status = 'active'
      and can_manage_photos
  );
$$;

-- Was is_hotel_manager(hotel_id) — every manager could change booking
-- status. Narrowed to the new flag; reading bookings (the separate SELECT
-- policy below) stays unconditional, since knowing who's staying is the
-- baseline front-desk job, not something admin should have to grant.
drop policy "hotel_bookings: manager updates status for assigned hotel" on public.hotel_bookings;

create policy "hotel_bookings: manager updates status when permitted"
  on public.hotel_bookings for update to authenticated
  using (public.hotel_manager_can_manage_bookings(hotel_id))
  with check (public.hotel_manager_can_manage_bookings(hotel_id));

-- New: hotels itself was SELECT-only for managers (20260820000003's
-- deliberate "never core listing identity" boundary). Photos are media, not
-- identity — name/address/star rating/publish status are still completely
-- unreachable by any manager, permitted or not, because the only write path
-- this policy's row-level grant is ever exercised through is the gallery
-- actions (image array only). Same trust model the codebase already uses
-- for hotel_partner_members on this same table: RLS gates by hotel/business,
-- the action layer is what actually narrows to specific fields.
create policy "hotels: manager updates photos when permitted"
  on public.hotels for update to authenticated
  using (public.hotel_manager_can_manage_photos(id))
  with check (public.hotel_manager_can_manage_photos(id));

-- admin_add_hotel_manager gains the two flags admin sets at assignment time
-- (defaulting off, same as the column defaults, so existing call sites that
-- don't pass them keep today's behaviour). admin_update_hotel_manager_
-- permissions is the new entry point for changing them afterwards.
create or replace function public.admin_add_hotel_manager(
  p_hotel_id uuid,
  p_email citext,
  p_can_manage_bookings boolean default false,
  p_can_manage_photos boolean default false
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

  insert into public.hotel_managers (hotel_id, profile_id, created_by, can_manage_bookings, can_manage_photos)
  values (p_hotel_id, target_profile_id, auth.uid(), p_can_manage_bookings, p_can_manage_photos)
  returning * into new_row;

  if target_role = 'customer' then
    perform public.promote_user_role(target_profile_id, 'hotel_manager');
  end if;

  return new_row;
end;
$$;

create or replace function public.admin_update_hotel_manager_permissions(
  p_manager_id uuid,
  p_can_manage_bookings boolean,
  p_can_manage_photos boolean
)
returns public.hotel_managers
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.hotel_managers;
begin
  if not public.is_admin() then
    raise exception 'only admins can change manager permissions';
  end if;

  update public.hotel_managers
  set can_manage_bookings = p_can_manage_bookings,
      can_manage_photos = p_can_manage_photos
  where id = p_manager_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Manager not found.';
  end if;

  return updated_row;
end;
$$;
