-- ============================================================================
-- Explicit role grants.
--
-- Newer Supabase Postgres images no longer ship blanket default privileges
-- for the API roles (anon/authenticated/service_role get only
-- TRUNCATE/REFERENCES/TRIGGER on new tables), so a fresh `db reset` — or a
-- brand-new hosted project — leaves PostgREST with "permission denied" on
-- every table. This schema was designed with RLS as the authorization
-- boundary and table grants as a given, so restore the classic grants
-- explicitly and re-apply the two deliberate column-level narrowings that a
-- blanket GRANT would otherwise undo.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all privileges on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- Re-apply deliberate narrowings (see 20260101000002 and 20260101000010):
-- profiles.role must never be client-writable; notifications are
-- system-authored except read_at.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, country_code, metadata)
  on public.profiles to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- audit_logs stay reachable only via the SECURITY DEFINER trigger / admin
-- policy paths; keep client roles read-only there.
revoke insert, update, delete on public.audit_logs from anon, authenticated;
