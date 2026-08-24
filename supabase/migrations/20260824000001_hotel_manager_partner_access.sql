-- ============================================================================
-- Lets a hotel partner assign managers to their own properties — previously
-- admin-only. Rather than a parallel partner_add_hotel_manager /
-- partner_update_hotel_manager_permissions / partner_remove_hotel_manager
-- trio (the exact "new capability = new RPC per caller" trap
-- 20260823000002 already called out for permissions), the three existing
-- RPCs are widened to accept either caller through one shared authorization
-- check. One implementation, two authorized callers — changing the manager
-- flow in future means editing these functions once, not twice.
-- ============================================================================

-- True for platform admin, or an active member of the hotel's OWNING
-- partner business. False for a partner_id-null (STS-direct/manual
-- inventory) hotel unless the caller is admin — those have no partner to
-- authorize through.
create or replace function public.can_manage_hotel_managers(p_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.hotels h
    where h.id = p_hotel_id
      and h.partner_id is not null
      and public.is_hotel_partner_member(h.partner_id)
  );
$$;

drop function public.admin_add_hotel_manager(uuid, citext, text[]);
drop function public.admin_update_hotel_manager_permissions(uuid, text[]);
drop function public.admin_remove_hotel_manager(uuid);

-- Same body as admin_add_hotel_manager, except: authorization goes through
-- can_manage_hotel_managers instead of is_admin(), and the 'customer' ->
-- 'hotel_manager' role bump is inlined rather than calling
-- promote_user_role() — that function has its own independent is_admin()
-- gate (it's the general-purpose role-promotion entry point, used well
-- beyond this flow, and widening ITS trust boundary would hand every
-- caller of it a broader capability than "promote the specific person I
-- just assigned as my own hotel's manager"). This function is already
-- security definer with its own narrow, already-checked authorization, so
-- doing the column update directly is the narrower — not the looser — choice.
create function public.add_hotel_manager(
  p_hotel_id uuid,
  p_email citext,
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
  if not public.can_manage_hotel_managers(p_hotel_id) then
    raise exception 'You do not have permission to assign managers for this hotel.';
  end if;

  select id, role into target_profile_id, target_role from public.profiles where email = p_email;
  if target_profile_id is null then
    raise exception 'No STS account found with that email.';
  end if;

  insert into public.hotel_managers (hotel_id, profile_id, created_by, permissions)
  values (p_hotel_id, target_profile_id, auth.uid(), p_permissions)
  returning * into new_row;

  if target_role = 'customer' then
    update public.profiles set role = 'hotel_manager' where id = target_profile_id;
  end if;

  return new_row;
end;
$$;

-- p_manager_id resolves its own hotel_id rather than trusting a
-- client-supplied one — otherwise a caller who manages hotel A could pass
-- hotel A's id alongside a manager_id that actually belongs to hotel B and
-- have the authorization check run against the wrong property.
create function public.update_hotel_manager_permissions(
  p_manager_id uuid,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
begin
  select hotel_id into v_hotel_id from public.hotel_managers where id = p_manager_id;
  if v_hotel_id is null then
    raise exception 'Manager not found.';
  end if;
  if not public.can_manage_hotel_managers(v_hotel_id) then
    raise exception 'You do not have permission to change this manager''s permissions.';
  end if;

  update public.hotel_managers set permissions = p_permissions where id = p_manager_id;
end;
$$;

create function public.remove_hotel_manager(p_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
begin
  select hotel_id into v_hotel_id from public.hotel_managers where id = p_manager_id;
  if v_hotel_id is null then
    raise exception 'Manager not found.';
  end if;
  if not public.can_manage_hotel_managers(v_hotel_id) then
    raise exception 'You do not have permission to remove this manager.';
  end if;

  update public.hotel_managers set status = 'removed' where id = p_manager_id;
end;
$$;

-- Table RLS: was admin-only (both read and write). Replaced with the same
-- shared check so the owning partner can see and manage their own hotel's
-- manager rows through this policy too — the three RPCs above are the only
-- write path exercised in practice (security definer bypasses this policy
-- for them regardless), but SELECT is enforced here and matters: without
-- it, getHotelManagers() would return nothing for a partner caller.
drop policy "hotel_managers: admin manage" on public.hotel_managers;

create policy "hotel_managers: authorized manage"
  on public.hotel_managers for all to authenticated
  using (public.can_manage_hotel_managers(hotel_id))
  with check (public.can_manage_hotel_managers(hotel_id));
