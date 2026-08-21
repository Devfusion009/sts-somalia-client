-- ============================================================================
-- Hotel managers — admin assigns a specific existing STS account to run ONE
-- hotel's rooms, inventory and bookings, without making them a member of the
-- owning hotel_partner (which grants every property that business has) and
-- without requiring the hotel to have a partner at all — STS-direct hotels
-- (partner_id null) can get a manager too, which hotel_partner_members
-- structurally cannot express (it FKs to hotel_partners).
--
-- Deliberately narrower than hotel_partner_members in every direction:
--   * scope: one (hotel, person) pair, not a whole business
--   * write access: rooms/inventory/bookings only — never the hotel's own
--     core listing fields (name, address, star rating, partner assignment)
--     or its publish status. That stays admin/owning-partner territory.
--   * provisioning: admin-added only (admin_add_hotel_manager) — no self-serve
--     application, because there's no business to apply with. Unlike
--     adminAddPartnerMember in modules/admin/partner-account-actions.ts, the
--     email doesn't need to belong to an existing STS account: the server
--     action creates one on the fly (see hotel-manager-actions.ts) before
--     calling this function, since a hotel manager has no other application
--     path to have signed up through first.
-- ============================================================================

create table public.hotel_managers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.member_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (hotel_id, profile_id)
);

create index hotel_managers_hotel_idx on public.hotel_managers (hotel_id);
create index hotel_managers_profile_idx on public.hotel_managers (profile_id) where status = 'active';

create or replace function public.is_hotel_manager(target_hotel_id uuid)
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
  );
$$;

-- Every hotel id the current user can operationally act on: business-wide via
-- hotel_partner_members, or single-hotel via hotel_managers. The one query
-- behind the /partner portal's "my hotels" scope for both kinds of user —
-- see getMyHotelScope in modules/hotels/partner-queries.ts.
create or replace function public.my_operable_hotel_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select h.id from public.hotels h
  where public.is_hotel_partner_member(h.partner_id)
  union
  select hm.hotel_id from public.hotel_managers hm
  where hm.profile_id = auth.uid() and hm.status = 'active';
$$;

-- Admin-only: assign an existing STS account as the manager of one hotel.
-- Promotes profiles.role to 'hotel_manager' ONLY when they're still a plain
-- 'customer' — a user who already holds a business role (hotel_partner,
-- agent, ...) keeps it. That role column only decides where a bare login
-- lands (see signInAction); every RLS check here goes through
-- is_hotel_manager()/hotel_managers directly, so leaving an existing role
-- alone costs the manager nothing and avoids demoting them out of a role
-- they still hold in truth.
create or replace function public.admin_add_hotel_manager(p_hotel_id uuid, p_email citext)
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

  insert into public.hotel_managers (hotel_id, profile_id, created_by)
  values (p_hotel_id, target_profile_id, auth.uid())
  returning * into new_row;

  if target_role = 'customer' then
    perform public.promote_user_role(target_profile_id, 'hotel_manager');
  end if;

  return new_row;
end;
$$;

create or replace function public.admin_remove_hotel_manager(p_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can remove hotel managers';
  end if;

  update public.hotel_managers set status = 'removed' where id = p_manager_id;
end;
$$;

alter table public.hotel_managers enable row level security;

create policy "hotel_managers: admin manage"
  on public.hotel_managers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_managers: self reads own assignment"
  on public.hotel_managers for select to authenticated
  using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Manager access to hotel-related tables. Deliberately SELECT-only on
-- `hotels` itself — a manager runs the room/inventory/booking side of one
-- property, never its core listing identity or publish state; ALL on
-- hotel_rooms/hotel_room_inventory (add/edit/remove rooms and set
-- availability) and SELECT+UPDATE on hotel_bookings (work the booking queue),
-- mirroring the scope hotel_partner_members already has, just narrowed to
-- one hotel_id instead of a whole partner_id.
-- ----------------------------------------------------------------------------
create policy "hotels: manager reads assigned"
  on public.hotels for select to authenticated
  using (public.is_hotel_manager(id));

create policy "hotel_rooms: manager manages assigned hotel"
  on public.hotel_rooms for all to authenticated
  using (public.is_hotel_manager(hotel_id))
  with check (public.is_hotel_manager(hotel_id));

create policy "hotel_room_inventory: manager manages assigned hotel"
  on public.hotel_room_inventory for all to authenticated
  using (exists (
    select 1 from public.hotel_rooms r where r.id = room_id and public.is_hotel_manager(r.hotel_id)
  ))
  with check (exists (
    select 1 from public.hotel_rooms r where r.id = room_id and public.is_hotel_manager(r.hotel_id)
  ));

create policy "hotel_bookings: manager reads bookings for assigned hotel"
  on public.hotel_bookings for select to authenticated
  using (public.is_hotel_manager(hotel_id));

create policy "hotel_bookings: manager updates status for assigned hotel"
  on public.hotel_bookings for update to authenticated
  using (public.is_hotel_manager(hotel_id))
  with check (public.is_hotel_manager(hotel_id));
