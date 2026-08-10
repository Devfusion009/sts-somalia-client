-- ============================================================================
-- Custom access token hook — publishes is_platform_admin into the JWT.
--
-- WHY
-- The proxy (src/proxy.ts) gates the admin origin before React renders. To
-- decide that it needs to know whether the caller is a platform admin, and the
-- only thing it holds is the session cookie. Without this claim it would have
-- to call the auth server and then query profiles on every single admin
-- request — two round trips before a byte of HTML.
--
-- With the claim in the token, the proxy verifies the JWT against the local
-- JWKS (cached in memory) and reads the flag. No database call on the hot path.
--
-- THIS IS NOT THE SECURITY BOUNDARY.
-- The claim is a routing hint that fails fast and keeps the console from
-- booting for the wrong account. Real enforcement stays where it was:
--   * RLS in Postgres (73 admin-gated policies), which no frontend can bypass
--   * requirePlatformAdmin() in the layout, which re-reads the live column
-- A token minted before an admin was demoted still carries is_platform_admin,
-- so the flag is deliberately re-checked server-side rather than trusted.
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  is_admin boolean;
  user_role public.app_role;
begin
  select p.is_platform_admin, p.role
    into is_admin, user_role
    from public.profiles p
   where p.id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- A missing profile means the row hasn't been created yet (the handle_new_user
  -- trigger runs on insert into auth.users). Default closed: no profile, no
  -- admin. Never raise — an exception here would block token issuance and lock
  -- everyone out of the platform.
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(coalesce(is_admin, false)));

  if user_role is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
exception
  when others then
    -- Same reasoning: a broken hook must degrade to "not admin" rather than
    -- taking authentication down. The layout guard still gates the console.
    return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Adds is_platform_admin and app_role to the JWT so the edge proxy can gate portal origins without a database round trip. Routing hint only — RLS and requirePlatformAdmin() remain the enforcement points.';

-- GoTrue runs the hook as supabase_auth_admin, which otherwise has no rights
-- here. Deliberately narrow: execute on this one function, select on the one
-- table it reads, and nothing else.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- The hook runs as supabase_auth_admin, which is NOT the signed-in user, so
-- profiles RLS would otherwise hide every row and the claim would always come
-- back false.
create policy "profiles: auth hook reads admin flag"
  on public.profiles for select to supabase_auth_admin
  using (true);

revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
