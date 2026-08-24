-- ============================================================================
-- One manager, one hotel, strictly — a person can hold at most one ACTIVE
-- hotel_managers row at a time, across every hotel, not just per hotel (the
-- existing unique(hotel_id, profile_id) only stopped a duplicate row for the
-- same hotel; it never stopped the same person being added to a second one).
-- Enforced as a real constraint, not just a UI rule, so it holds regardless
-- of which caller (admin or the owning partner) adds the manager.
-- ============================================================================

-- Partial so a removed assignment (status = 'removed') never blocks a fresh
-- one elsewhere — only one ACTIVE row per profile is the actual rule.
create unique index hotel_managers_one_active_hotel_per_profile
  on public.hotel_managers (profile_id)
  where status = 'active';

create or replace function public.add_hotel_manager(
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

  -- Checked explicitly (ahead of the unique index doing it anyway) so the
  -- error names the actual rule instead of surfacing as a raw constraint
  -- violation — same shape as the existing "already manages this hotel" 23505
  -- catch on the TypeScript side of this call.
  if exists (
    select 1 from public.hotel_managers where profile_id = target_profile_id and status = 'active'
  ) then
    raise exception 'This person already manages another hotel. Remove them from it first.';
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
