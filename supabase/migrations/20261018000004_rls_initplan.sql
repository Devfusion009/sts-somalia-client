-- Evaluate session-constant RLS checks once per statement, on every policy.
--
-- A bare auth.uid(), is_admin() or visa_staff_can('<permission>') in a policy
-- is re-evaluated for every row the query touches. Wrapped in a scalar
-- sub-select, Postgres plans it as an InitPlan and evaluates it once. On
-- orders (20261018000001) that took a full count from 1564 ms to 15 ms at
-- 100k rows. This finishes the job for every other policy in public.
--
-- The three functions are STABLE and take no row input (visa_staff_can only a
-- literal), so their value cannot change within a statement: each policy keeps
-- its exact meaning. Nothing else in any policy is touched.
--
-- Each policy is rewritten from its live definition at apply time, not from a
-- copy taken on a developer database, so it is correct on whichever database
-- runs it, and running it again is a no-op.
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_stmt text;
  v_path text := current_setting('search_path');
begin
  -- Deparse with every name schema-qualified, so the text is valid as written.
  perform set_config('search_path', '', true);

  for r in
    select p.polname, c.relname,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    where c.relnamespace = 'public'::regnamespace
  loop
    v_using := r.qual;
    v_check := r.check_expr;
    v_using := regexp_replace(v_using, '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    v_using := regexp_replace(v_using, '(?<!SELECT )public\.is_admin\(\)', '(SELECT public.is_admin())', 'g');
    v_using := regexp_replace(v_using, '(?<!SELECT )(public\.visa_staff_can\(''[^'']*''::text\))', '(SELECT \1)', 'g');
    v_check := regexp_replace(v_check, '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    v_check := regexp_replace(v_check, '(?<!SELECT )public\.is_admin\(\)', '(SELECT public.is_admin())', 'g');
    v_check := regexp_replace(v_check, '(?<!SELECT )(public\.visa_staff_can\(''[^'']*''::text\))', '(SELECT \1)', 'g');

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
