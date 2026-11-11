-- Optional travel and emergency details supplement the required traveler identity.
alter table public.agency_customers
  add column residence_country char(2),
  add column city text,
  add column postal_code text,
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column emergency_contact_relationship text,
  add column preferred_cabin text check (preferred_cabin in ('economy', 'premium_economy', 'business', 'first')),
  add column travel_preferences text;
