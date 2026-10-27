-- Account security: live sessions, security activity and 2FA recovery codes.
--
-- 1. login_events becomes the account's security activity log: sign-ins plus
--    password, two-factor and sign-out changes. Each sign-in carries the
--    Supabase session it opened (one row per session) and the approximate
--    location the hosting edge reports.
-- 2. my_auth_sessions() / revoke_my_session(): the signed-in user's own live
--    sessions from auth.sessions (not exposed through PostgREST), and signing
--    one of them out. Deleting the session row deletes its refresh tokens, so
--    that device cannot renew its access token; the token it already holds
--    lapses at its expiry (jwt_expiry).
-- 3. mfa_recovery_codes: one-time codes for a lost authenticator, stored as
--    hashes. No client policy exists; only the server (service role) reads or
--    writes them.

-- ----------------------------------------------------------------------------
-- 1. Security activity
-- ----------------------------------------------------------------------------
alter table public.login_events
  add column event text not null default 'sign_in'
    check (event in (
      'sign_in',
      'password_changed',
      'mfa_enabled',
      'mfa_disabled',
      'recovery_codes_generated',
      'recovery_code_used',
      'signed_out_others',
      'session_revoked'
    )),
  add column session_id uuid,
  add column city text check (city is null or char_length(city) <= 80),
  add column country text check (country is null or char_length(country) <= 2);

create unique index login_events_one_sign_in_per_session
  on public.login_events (profile_id, session_id)
  where event = 'sign_in' and session_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Live sessions
-- ----------------------------------------------------------------------------
create or replace function public.my_auth_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  active_recently boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at)::timestamptz,
         s.user_agent,
         host(s.ip),
         s.aal::text,
         coalesce(s.refreshed_at, s.updated_at, s.created_at)::timestamptz > now() - interval '10 minutes'
    from auth.sessions s
   where s.user_id = auth.uid()
     and (s.not_after is null or s.not_after > now())
   order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc
   limit 50;
$$;

revoke execute on function public.my_auth_sessions() from public, anon;
grant execute on function public.my_auth_sessions() to authenticated;

create or replace function public.revoke_my_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.revoke_my_session(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Recovery codes
-- ----------------------------------------------------------------------------
create table public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- sha256(profile_id || ':' || normalized code), hex
  code_hash text not null check (char_length(code_hash) = 64),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index mfa_recovery_codes_unused_idx
  on public.mfa_recovery_codes (profile_id)
  where used_at is null;

alter table public.mfa_recovery_codes enable row level security;
