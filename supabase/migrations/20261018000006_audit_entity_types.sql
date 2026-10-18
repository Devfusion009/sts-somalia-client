-- Entity types for the audit log's filter, read from the index.
--
-- The page built this list by reading audit_logs rows and de-duplicating them
-- in the app. PostgREST returns at most 1000 rows per request, in no
-- particular order, so a type that only appears in older rows could be missing
-- from the filter, and every load moved up to 1000 rows to produce a short list.
--
-- This walks audit_logs_entity_idx (entity_type, entity_id) once per distinct
-- type — each step is one index probe for the next type — so its cost tracks
-- the number of types, not the number of log rows.
--
-- SECURITY INVOKER: audit_logs RLS still applies, so only platform admins get
-- rows back, exactly as with the direct select it replaces.
create or replace function public.audit_log_entity_types()
returns table (entity_type text)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with recursive types as (
    select min(a.entity_type) as v from public.audit_logs a
    union all
    select (select min(a.entity_type) from public.audit_logs a where a.entity_type > types.v)
    from types
    where types.v is not null
  )
  select v from types where v is not null order by v;
$$;

revoke all on function public.audit_log_entity_types() from public, anon;
grant execute on function public.audit_log_entity_types() to authenticated;
