-- Agency customer accounts: connect the agency's client book to the real
-- B2C accounts behind it, and close the two verticals that drop the
-- customer on the floor.
--
--   1. agency_customers.profile_id — links a client-book entry to the
--      registered B2C profile with the same email. Maintained by triggers
--      in BOTH directions: when an agent saves a customer whose email
--      already has an account, and when a person later signs up with an
--      email an agent had already saved. Informational only — it never
--      grants the agency any access to the profile.
--   2. visa_applications.agency_customer_id / flight_bookings
--      .agency_customer_id — hotels, umrah, and events already record who
--      an agent booked for (orders.agency_customer_id); visa applications
--      and flight quote requests recorded only the agency. Visa carries
--      the customer through the wizard so submit can stamp the order;
--      flight quotes have no order until staff finalize one, so the
--      booking row itself is the attribution record.
--   3. agencies.about / website / address — the agency-authored profile
--      shown in its portal and on the admin's per-agency console.

-- 1. ------------------------------------------------------------------
alter table public.agency_customers
  add column profile_id uuid references public.profiles (id) on delete set null;

-- Not unique: one agency can hold two client entries that resolve to the
-- same account (duplicate emails already exist in real client books), and
-- the same person may be a client of several agencies.
create index agency_customers_profile_idx
  on public.agency_customers (profile_id)
  where profile_id is not null;

-- Email is the only linking key, so the link is recomputed whenever the
-- email changes (and cleared when it's removed). SECURITY DEFINER: agency
-- members cannot read other profiles under RLS, and must not be able to —
-- the lookup runs with the function owner's rights instead.
-- search_path includes `extensions` (citext's home): with `public` alone,
-- the citext = citext operator falls back to a text comparison and the
-- match silently turns case-SENSITIVE.
create or replace function public.link_agency_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.email is null then
    new.profile_id := null;
  else
    select p.id into new.profile_id
    from public.profiles p
    where p.email = new.email
    limit 1;
  end if;
  return new;
end;
$$;

create trigger agency_customers_link_profile
  before insert or update of email on public.agency_customers
  for each row execute function public.link_agency_customer_profile();

-- The other direction: a signup (or email change) claims every unlinked
-- client-book entry saved under that email, across all agencies.
create or replace function public.link_agency_customers_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.email is not null then
    update public.agency_customers
      set profile_id = new.id
      where profile_id is null
        and email = new.email;
  end if;
  return new;
end;
$$;

create trigger profiles_link_agency_customers
  after insert or update of email on public.profiles
  for each row execute function public.link_agency_customers_to_profile();

-- Backfill existing matches.
update public.agency_customers ac
  set profile_id = p.id
  from public.profiles p
  where ac.profile_id is null
    and ac.email is not null
    and p.email = ac.email;

-- 2. ------------------------------------------------------------------
alter table public.visa_applications
  add column agency_customer_id uuid references public.agency_customers (id) on delete set null;

alter table public.flight_bookings
  add column agency_customer_id uuid references public.agency_customers (id) on delete set null;

create index visa_applications_agency_customer_idx
  on public.visa_applications (agency_customer_id)
  where agency_customer_id is not null;

create index flight_bookings_agency_customer_idx
  on public.flight_bookings (agency_customer_id)
  where agency_customer_id is not null;

-- 3. ------------------------------------------------------------------
alter table public.agencies
  add column about text,
  add column website text,
  add column address text;
