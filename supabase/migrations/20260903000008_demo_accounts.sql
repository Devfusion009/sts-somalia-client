-- One-click demo accounts, one per portal (customer/agent/admin/hotel
-- manager). Applies everywhere migrations always apply — same schema, same
-- data, every environment — but the ONE-CLICK BUTTON that uses them is
-- gated by DEMO_LOGIN_ENABLED, a plain (non-secret) env var set only in
-- .github/workflows/deploy.yml's web deploy step, never in a local .env.
-- So these rows exist locally too after this migration, they just sit
-- unused: nothing in local dev ever renders the button that signs into them.
--
-- Passwords are fixed and deliberately not secret — anyone who can already
-- reach the login page can already see they exist. They exist to open a
-- disposable, clearly-labeled demo identity, never real customer data.
--
-- Written directly against auth.users/auth.identities (the same approach
-- Supabase's own seeding guides use) rather than the client-side
-- supabase.auth.signUp() API, because this runs inside `supabase db push`
-- with no service-role key involved at all.
do $$
declare
  v_customer_id uuid := gen_random_uuid();
  v_agent_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
  v_manager_id uuid := gen_random_uuid();
  v_agency_id uuid;
  -- Ambassador Hotel Hargeisa — a real, published, priced hotel (see
  -- 20260817000001 / 20260903000006) so the demo manager has something
  -- real to manage rather than an empty property.
  v_hotel_id uuid := '671799ff-918a-48c1-8fea-3facce7a8a27';
  -- Schema-qualified: pgcrypto lives in the `extensions` schema on Supabase
  -- projects, and the connection `supabase db push` runs migrations over
  -- doesn't carry the same default search_path an interactive session does
  -- (the same gap 8658cef already hit and fixed for citext).
  v_password text := extensions.crypt('StsDemo!2026', extensions.gen_salt('bf'));
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_customer_id, 'authenticated', 'authenticated',
     'demo.customer@stssomalia.com', v_password, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Demo Customer"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_agent_id, 'authenticated', 'authenticated',
     'demo.agent@stssomalia.com', v_password, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Demo Agent"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
     'demo.admin@stssomalia.com', v_password, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Demo Admin"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_manager_id, 'authenticated', 'authenticated',
     'demo.manager@stssomalia.com', v_password, now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Demo Manager"}'::jsonb,
     now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_customer_id, jsonb_build_object('sub', v_customer_id::text, 'email', 'demo.customer@stssomalia.com'), 'email', v_customer_id::text, now(), now(), now()),
    (gen_random_uuid(), v_agent_id, jsonb_build_object('sub', v_agent_id::text, 'email', 'demo.agent@stssomalia.com'), 'email', v_agent_id::text, now(), now(), now()),
    (gen_random_uuid(), v_admin_id, jsonb_build_object('sub', v_admin_id::text, 'email', 'demo.admin@stssomalia.com'), 'email', v_admin_id::text, now(), now(), now()),
    (gen_random_uuid(), v_manager_id, jsonb_build_object('sub', v_manager_id::text, 'email', 'demo.manager@stssomalia.com'), 'email', v_manager_id::text, now(), now(), now());

  -- handle_new_user() (20260101000002) already created a 'customer'-role
  -- profile row for every one of the four via the auth.users insert
  -- trigger above; only the non-customer three need anything further.

  update public.profiles set is_platform_admin = true where id = v_admin_id;

  insert into public.agencies (name, contact_email, status, commission_rate, credit_limit, credit_balance)
  values ('STS Demo Agency', 'demo.agent@stssomalia.com', 'active', 10, 5000, 1000)
  returning id into v_agency_id;

  insert into public.agency_members (agency_id, profile_id, role_in_agency, status)
  values (v_agency_id, v_agent_id, 'owner', 'active');

  if exists (select 1 from public.hotels where id = v_hotel_id) then
    insert into public.hotel_managers (hotel_id, profile_id, status)
    values (v_hotel_id, v_manager_id, 'active');
  end if;
end $$;
