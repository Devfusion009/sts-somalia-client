-- Pin search_path on every function in public that does not set one.
--
-- A function without its own search_path resolves unqualified names against
-- the caller's path. A caller who puts a schema of their own ahead of public
-- can then substitute a table, operator or function the body uses. Every
-- SECURITY DEFINER function here already pins it; this covers the rest (the
-- reference generators, trigger functions, label helpers and the auth access
-- token hook), which is the Supabase advisor lint
-- 0011_function_search_path_mutable.
--
-- The value is public, extensions, pg_temp. The bodies use unqualified names
-- from public only, and pgcrypto, pg_trgm and citext live in extensions, so
-- each body resolves the same objects it does today. pg_temp goes last so a
-- temporary table can never shadow a real one.
--
-- LANGUAGE sql functions are left alone. The planner inlines a SQL function
-- into the calling query, which lets hall_slots_overlap or
-- hotel_booking_front_desk_status use the caller's indexes, and it never
-- inlines a function that carries a SET clause. Pinning those would make
-- every query that calls them slower. Their bodies call only built-ins and
-- schema-qualified objects, so the caller's path cannot redirect them.
--
-- Functions are found in the live catalog at apply time, so a second run is a
-- no-op. Functions owned by an extension are skipped.
do $$
declare
  r record;
  v_path text := current_setting('search_path');
begin
  -- Print every signature schema-qualified, so the ALTER names it exactly.
  perform set_config('search_path', '', true);

  for r in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and p.prolang <> (select oid from pg_catalog.pg_language where lanname = 'sql')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
        where cfg like 'search_path=%'
      )
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format('alter routine %s set search_path = public, extensions, pg_temp', r.signature);
  end loop;

  perform set_config('search_path', v_path, true);
end;
$$;
