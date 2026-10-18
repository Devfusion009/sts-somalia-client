-- RLS membership checks: one lookup per statement instead of one per row.
--
-- Policies call helpers such as is_agency_member(agency_id) and
-- is_hotel_manager(hotel_id) with a column of the row, so Postgres runs the
-- helper — a SECURITY DEFINER function with its own index lookup — once for
-- every row it reads. At 100k hotel bookings an admin's count spent 840 ms
-- there, even after 20261018000004 hoisted the session-constant checks.
--
-- Each helper answers "is this id in the set of ids the signed-in user has
-- membership X in". The functions below return that set as one array, built
-- with exactly the helper's own WHERE clause, and the policies compare the
-- row's column against it:
--
--   is_agency_member(agency_id)
--     -> COALESCE(agency_id = ANY ((SELECT my_agency_ids())::uuid[]), false)
--
-- The sub-select has no row input, so it is planned as an InitPlan and runs
-- once per statement. COALESCE keeps a NULL column false, as the helper's
-- EXISTS was. The helpers themselves stay (functions and app code call
-- them); only policy expressions change.
--
-- Not rewritten, because they are not a fixed set of ids per user:
-- can_access_order (any order for an admin), can_manage_hotel_managers and
-- can_manage_venue_managers (an admin bypass inside the function).
--
-- Like 20261018000004, policies are rewritten from their live definitions at
-- apply time, and a second run is a no-op.

-- ----------------------------------------------------------------------------
-- 1. Membership sets for the signed-in user
-- ----------------------------------------------------------------------------
create or replace function public.my_agency_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(agency_id), '{}') from public.agency_members
  where profile_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_agency_admin_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(agency_id), '{}') from public.agency_members
  where profile_id = auth.uid() and role_in_agency in ('owner', 'admin') and status = 'active';
$$;

create or replace function public.my_agency_booker_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(agency_id), '{}') from public.agency_members
  where profile_id = auth.uid() and role_in_agency in ('owner', 'admin', 'booking_staff') and status = 'active';
$$;

create or replace function public.my_hotel_partner_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(partner_id), '{}') from public.hotel_partner_members
  where profile_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_hotel_partner_owner_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(partner_id), '{}') from public.hotel_partner_members
  where profile_id = auth.uid() and role_in_partner = 'owner' and status = 'active';
$$;

create or replace function public.my_venue_partner_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(partner_id), '{}') from public.venue_partner_members
  where profile_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_venue_partner_owner_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(partner_id), '{}') from public.venue_partner_members
  where profile_id = auth.uid() and status = 'active' and role_in_partner = 'owner';
$$;

create or replace function public.my_managed_hotel_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(hotel_id), '{}') from public.hotel_managers
  where profile_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_managed_hotel_ids_with(perm text)
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(hotel_id), '{}') from public.hotel_managers
  where profile_id = auth.uid() and status = 'active' and perm = any (permissions);
$$;

create or replace function public.my_managed_venue_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(venue_id), '{}') from public.venue_managers
  where profile_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_managed_venue_ids_with(perm text)
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(venue_id), '{}') from public.venue_managers
  where profile_id = auth.uid() and status = 'active' and perm = any (permissions);
$$;

create or replace function public.my_affiliate_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(id), '{}') from public.affiliates where profile_id = auth.uid();
$$;

-- Profiles sharing an active agency or hotel-partner membership with the
-- signed-in user — the set shares_active_org_with() tests one id against.
create or replace function public.my_teammate_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(distinct profile_id), '{}') from (
    select m2.profile_id
    from public.agency_members m1
    join public.agency_members m2 on m1.agency_id = m2.agency_id
    where m1.profile_id = auth.uid() and m1.status = 'active' and m2.status = 'active'
    union all
    select m2.profile_id
    from public.hotel_partner_members m1
    join public.hotel_partner_members m2 on m1.partner_id = m2.partner_id
    where m1.profile_id = auth.uid() and m1.status = 'active' and m2.status = 'active'
  ) t;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'my_agency_ids()', 'my_agency_admin_ids()', 'my_agency_booker_ids()',
    'my_hotel_partner_ids()', 'my_hotel_partner_owner_ids()',
    'my_venue_partner_ids()', 'my_venue_partner_owner_ids()',
    'my_managed_hotel_ids()', 'my_managed_hotel_ids_with(text)',
    'my_managed_venue_ids()', 'my_managed_venue_ids_with(text)',
    'my_affiliate_ids()', 'my_teammate_ids()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Policies: membership helper calls -> array membership
-- ----------------------------------------------------------------------------
create or replace function pg_temp.rls_membership_rewrite(expr text)
returns text language plpgsql immutable as $$
declare
  -- A column reference, optionally table-qualified, as pg_get_expr prints it.
  col constant text := '([a-z_]+(?:\.[a-z_]+)?)';
  rule text[];
  rules constant text[][] := array[
    array['is_agency_member\(' || col || '\)', 'my_agency_ids()'],
    array['is_agency_owner_or_admin\(' || col || '\)', 'my_agency_admin_ids()'],
    array['is_agency_booker\(' || col || '\)', 'my_agency_booker_ids()'],
    array['is_hotel_partner_member\(' || col || '\)', 'my_hotel_partner_ids()'],
    array['is_hotel_partner_owner\(' || col || '\)', 'my_hotel_partner_owner_ids()'],
    array['is_venue_partner_member\(' || col || '\)', 'my_venue_partner_ids()'],
    array['is_venue_partner_owner\(' || col || '\)', 'my_venue_partner_owner_ids()'],
    array['is_hotel_manager\(' || col || '\)', 'my_managed_hotel_ids()'],
    array['hotel_manager_can_manage_bookings\(' || col || '\)', 'my_managed_hotel_ids_with(''bookings''::text)'],
    array['hotel_manager_can_manage_photos\(' || col || '\)', 'my_managed_hotel_ids_with(''photos''::text)'],
    array['is_venue_manager\(' || col || '\)', 'my_managed_venue_ids()'],
    array['is_affiliate_owner\(' || col || '\)', 'my_affiliate_ids()'],
    array['shares_active_org_with\(' || col || '\)', 'my_teammate_ids()']
  ];
begin
  if expr is null then
    return null;
  end if;
  foreach rule slice 1 in array rules loop
    expr := regexp_replace(expr, 'public\.' || rule[1],
      'COALESCE((\1 = ANY ((SELECT public.' || rule[2] || ')::uuid[])), false)', 'g');
  end loop;
  -- Hotel-scoped rows reach the partner through a scalar sub-select on hotels;
  -- a hotel with no partner yields NULL, which COALESCE keeps false.
  expr := regexp_replace(expr,
    'public\.is_hotel_partner_member\((\( SELECT hotels\.partner_id\s+FROM public\.hotels\s+WHERE \(hotels\.id = [a-z_]+(?:\.[a-z_]+)?\)\))\)',
    'COALESCE((\1 = ANY ((SELECT public.my_hotel_partner_ids())::uuid[])), false)', 'g');
  -- Permission-scoped manager checks carry the permission as a literal.
  expr := regexp_replace(expr, 'public\.hotel_manager_has_permission\(' || col || ', (''[a-z_]+''::text)\)',
    'COALESCE((\1 = ANY ((SELECT public.my_managed_hotel_ids_with(\2))::uuid[])), false)', 'g');
  expr := regexp_replace(expr, 'public\.venue_manager_has_permission\(' || col || ', (''[a-z_]+''::text)\)',
    'COALESCE((\1 = ANY ((SELECT public.my_managed_venue_ids_with(\2))::uuid[])), false)', 'g');
  return expr;
end;
$$;

do $$
declare
  r record;
  v_using text;
  v_check text;
  v_stmt text;
  v_path text := current_setting('search_path');
begin
  perform set_config('search_path', '', true);

  for r in
    select p.polname, c.relname,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    where c.relnamespace = 'public'::regnamespace
  loop
    v_using := pg_temp.rls_membership_rewrite(r.qual);
    v_check := pg_temp.rls_membership_rewrite(r.check_expr);

    if v_using is distinct from r.qual or v_check is distinct from r.check_expr then
      v_stmt := format('alter policy %I on public.%I', r.polname, r.relname);
      if v_using is distinct from r.qual then
        v_stmt := v_stmt || format(' using (%s)', v_using);
      end if;
      if v_check is distinct from r.check_expr then
        v_stmt := v_stmt || format(' with check (%s)', v_check);
      end if;
      execute v_stmt;
    end if;
  end loop;

  perform set_config('search_path', v_path, true);
end;
$$;
