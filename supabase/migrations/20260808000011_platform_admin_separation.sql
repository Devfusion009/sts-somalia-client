-- ============================================================================
-- Platform-admin / business-role separation
-- ============================================================================
-- profiles.role was doing two unrelated jobs: "what business role does this
-- account hold" (customer/agent/hotel_partner/affiliate) AND "is this person
-- a platform admin." A single overwritable enum value meant approving an
-- agency application through your own admin account silently demoted you
-- from admin to agent (promote_user_role() just overwrote role wholesale).
--
-- This migration adds a dedicated is_platform_admin flag that only
-- set_platform_admin() (below) can change, and repoints is_admin() at it so
-- every existing RLS policy that calls is_admin() is fixed automatically —
-- no per-policy edits needed. promote_user_role() can no longer grant or
-- imply 'admin' at all, closing the theoretical escalation path even though
-- no shipped UI ever exercised it.

alter table public.profiles
  add column is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is
  'Platform-admin flag, separate from the business-role enum. Only settable via set_platform_admin(). Never touched by promote_user_role() or any business-role approval flow.';

-- Backfill: every account currently sitting on role='admin' becomes a
-- platform admin. role itself is left untouched here — a later cleanup can
-- decide whether 'admin' stays a valid business-role value or is retired.
update public.profiles set is_platform_admin = true where role = 'admin';

-- ----------------------------------------------------------------------------
-- is_admin() now reads the dedicated flag instead of the flat role column.
-- Every RLS policy across the schema that calls public.is_admin() inherits
-- this fix with no per-policy changes required.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_platform_admin
  );
$$;

-- ----------------------------------------------------------------------------
-- promote_user_role() can no longer grant 'admin' — business-role promotion
-- (agent/hotel_partner/affiliate approval) and platform-admin status are now
-- fully separate code paths, so an agency/hotel/affiliate approval can never
-- again overwrite the approving admin's own privilege level.
-- ----------------------------------------------------------------------------
create or replace function public.promote_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can promote user roles';
  end if;

  if new_role = 'admin' then
    raise exception 'promote_user_role() cannot grant admin; use set_platform_admin() instead';
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- The only path that can change is_platform_admin. Admin-only, and
-- deliberately separate from every business-role workflow.
-- ----------------------------------------------------------------------------
create or replace function public.set_platform_admin(target_user_id uuid, new_is_platform_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only platform admins can change platform-admin status';
  end if;

  update public.profiles set is_platform_admin = new_is_platform_admin where id = target_user_id;
end;
$$;

comment on function public.set_platform_admin(uuid, boolean) is
  'The sole path that can change is_platform_admin. Never called from promote_user_role() or any agency/hotel/affiliate approval function.';
