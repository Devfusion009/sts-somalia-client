-- ============================================================================
-- Customer Account Center
--
-- Turns /account from "profile form + booking list" into a real OTA account
-- section: reusable traveler identities, a document vault, booking service
-- requests, remembered payer details, preferences, and security history.
--
-- Design note on travelers. There is ONE table for "a person who travels",
-- with an `is_self` flag marking the account holder's own row. The
-- alternative — passport columns on `profiles` plus a separate `family
-- members` table — duplicates the same six fields, the same validation, and
-- the same expiry-warning logic in two places, and then has to reconcile them
-- when the account holder is also a passenger. One shape, one validator.
--
-- `visa_members` deliberately stays as-is: it is a point-in-time SNAPSHOT of
-- who was on a given application and must not change when someone later edits
-- their saved profile. Saved travelers PREFILL that snapshot; they don't
-- replace it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Traveler profiles
-- ----------------------------------------------------------------------------
create table public.traveler_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- The account holder's own traveler record. Exactly one per owner.
  is_self boolean not null default false,
  full_name text not null,
  -- Free-ish text constrained to the same vocabulary the visa wizard uses
  -- (src/modules/visa/schemas.ts RELATIONSHIPS) so saved travelers can prefill
  -- a visa member row without a mapping layer.
  relationship text not null default 'self'
    check (relationship in (
      'self', 'spouse', 'son', 'daughter', 'father', 'mother',
      'brother', 'sister', 'grandfather', 'grandmother', 'other'
    )),
  date_of_birth date,
  gender text check (gender in ('male', 'female')),
  -- ISO 3166-1 alpha-2, matching src/lib/countries.ts and the visa schemas.
  nationality text check (nationality is null or length(nationality) = 2),
  passport_number text,
  passport_issue_date date,
  passport_expiry date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An issue date after the expiry date is data entry gone wrong, not a valid
  -- passport. Caught here so no code path can persist it.
  constraint traveler_passport_dates_ordered check (
    passport_issue_date is null
    or passport_expiry is null
    or passport_issue_date < passport_expiry
  ),
  constraint traveler_self_is_self_relationship check (
    not is_self or relationship = 'self'
  )
);

comment on table public.traveler_profiles is
  'Reusable traveler identities. is_self = the account holder; the rest are saved companions used to prefill visa/Umrah bookings.';

create unique index traveler_profiles_one_self_per_owner
  on public.traveler_profiles (owner_id) where is_self;

create index traveler_profiles_owner_idx on public.traveler_profiles (owner_id, is_self desc, full_name);
-- Powers the "passport expiring soon" sweep without a full scan.
create index traveler_profiles_expiry_idx on public.traveler_profiles (passport_expiry)
  where passport_expiry is not null;

create trigger set_traveler_profiles_updated_at
  before update on public.traveler_profiles
  for each row execute function public.set_updated_at();

alter table public.traveler_profiles enable row level security;

create policy "traveler_profiles: owner manages own"
  on public.traveler_profiles for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Staff need to see a traveler's passport details to process a visa or Umrah
-- booking they are actually working on. Read-only: only the customer edits
-- their own identity records.
create policy "traveler_profiles: admin read"
  on public.traveler_profiles for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Document vault
--
-- Storage layout: traveler-documents/{owner_id}/{document_id}.{ext}
-- The owner_id prefix is what the storage RLS policies key off, exactly as
-- kyc-documents and avatars already do.
-- ----------------------------------------------------------------------------
create type public.traveler_document_type as enum (
  'passport_bio',
  'passport_photo',
  'national_id',
  'photo',
  'vaccination',
  'bank_statement',
  'employment_letter',
  'invitation_letter',
  'travel_insurance',
  'other'
);

create table public.traveler_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Which saved traveler this belongs to. Nullable: a bank statement or
  -- invitation letter often covers the whole family, not one person.
  traveler_id uuid references public.traveler_profiles (id) on delete set null,
  document_type public.traveler_document_type not null default 'other',
  label text,
  storage_path text not null unique,
  file_name text not null,
  file_size integer,
  content_type text,
  -- Documents expire too (visas, insurance, vaccination certificates).
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.traveler_documents is
  'Upload-once travel document vault. Files live in the private traveler-documents bucket under {owner_id}/.';

create index traveler_documents_owner_idx on public.traveler_documents (owner_id, created_at desc);
create index traveler_documents_traveler_idx on public.traveler_documents (traveler_id);

create trigger set_traveler_documents_updated_at
  before update on public.traveler_documents
  for each row execute function public.set_updated_at();

alter table public.traveler_documents enable row level security;

create policy "traveler_documents: owner manages own"
  on public.traveler_documents for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Deliberately NO blanket admin read on the vault.
--
-- The vault is the customer's private filing cabinet, not a staff-browsable
-- store. Staff see a document when the customer ATTACHES it to an application
-- — at which point it is copied into visa-documents, which already has its own
-- admin-visible policy. A passport scan uploaded "just in case" stays private.

insert into storage.buckets (id, name, public) values
  ('traveler-documents', 'traveler-documents', false)
on conflict (id) do nothing;

create policy "traveler_documents: owner reads own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'traveler-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "traveler_documents: owner writes own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'traveler-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "traveler_documents: owner updates own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'traveler-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'traveler-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "traveler_documents: owner deletes own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'traveler-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Remembered payer details
--
-- Extends the existing (previously unused) payment_methods table rather than
-- adding a parallel one, so there is a single "how this customer pays" concept.
--
-- No card is tokenized here. The live providers are WAAFI and eDahab (mobile
-- money, addressed by phone number), manual bank transfer, cash at office, and
-- Stripe hosted Checkout — none of which hand back a reusable card token
-- today. What we CAN usefully remember is the wallet number to prefill.
-- provider_payment_method_id therefore becomes nullable; the column stays so
-- Stripe SetupIntent tokens can be stored later without another migration.
-- ----------------------------------------------------------------------------
alter table public.payment_methods
  alter column provider_payment_method_id drop not null;

alter table public.payment_methods
  add column kind text not null default 'mobile_money'
    check (kind in ('mobile_money', 'card', 'bank')),
  add column label text,
  -- E.164-ish wallet number for EVC Plus / eDahab.
  add column msisdn text,
  add column updated_at timestamptz not null default now();

-- A saved method has to be addressable by *something*: a wallet number for
-- mobile money, or a provider token for a real card.
alter table public.payment_methods
  add constraint payment_methods_addressable check (
    msisdn is not null or provider_payment_method_id is not null
  );

create trigger set_payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- Only one default per customer. A partial unique index enforces what would
-- otherwise be an application-level race between two concurrent "make default"
-- clicks.
create unique index payment_methods_one_default_per_customer
  on public.payment_methods (customer_id) where is_default;

-- ----------------------------------------------------------------------------
-- Booking service requests
--
-- cancel_order() already handles the easy case: an order still held or awaiting
-- payment is cancelled outright, in-process. Once money has moved, cancelling,
-- refunding, or changing a booking is a conversation with staff, not a button
-- that mutates a row. This table is that conversation's queue.
-- ----------------------------------------------------------------------------
create type public.booking_request_kind as enum ('cancellation', 'refund', 'modification');

create type public.booking_request_status as enum (
  'requested',
  'in_review',
  'approved',
  'rejected',
  'completed',
  'withdrawn'
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  kind public.booking_request_kind not null,
  status public.booking_request_status not null default 'requested',
  reason text not null,
  -- Requested refund amount. Null = "whatever the fare rules allow", which is
  -- the honest default since the customer cannot compute the penalty.
  requested_amount numeric(12,2) check (requested_amount is null or requested_amount >= 0),
  approved_amount numeric(12,2) check (approved_amount is null or approved_amount >= 0),
  currency text not null default 'USD',
  staff_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.booking_requests is
  'Customer-initiated cancel/refund/change requests against a paid order. Staff resolve these from the admin portal.';

create index booking_requests_order_idx on public.booking_requests (order_id, created_at desc);
create index booking_requests_requester_idx on public.booking_requests (requested_by, created_at desc);
-- Admin queue: open requests, oldest first.
create index booking_requests_open_idx on public.booking_requests (status, created_at)
  where status in ('requested', 'in_review');

create trigger set_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

alter table public.booking_requests enable row level security;

create policy "booking_requests: read via parent order"
  on public.booking_requests for select to authenticated
  using (public.can_access_order(order_id));

create policy "booking_requests: customer opens on own order"
  on public.booking_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and public.can_access_order(order_id)
  );

-- The customer may withdraw a request they opened, and nothing else. Status,
-- amounts, and staff notes are the resolving side's to write — a WITH CHECK
-- that pins status to 'withdrawn' is what stops a customer self-approving a
-- refund.
create policy "booking_requests: customer withdraws own open request"
  on public.booking_requests for update to authenticated
  using (
    requested_by = auth.uid()
    and status in ('requested', 'in_review')
  )
  with check (
    requested_by = auth.uid()
    and status = 'withdrawn'
  );

create policy "booking_requests: admin manage"
  on public.booking_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Notification preferences
-- ----------------------------------------------------------------------------
create type public.account_language as enum ('en', 'so', 'ar');

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default true,
  -- Language for OUTBOUND messages (email/WhatsApp templates). The web UI is
  -- English-only — there is no i18n layer in this codebase — so this must not
  -- be read as a UI locale.
  language public.account_language not null default 'en',
  -- Display currency only. Orders are still quoted, stored, and charged in the
  -- listing's own currency; see fx_rates.
  display_currency text not null default 'USD'
    check (length(display_currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.notification_preferences.display_currency is
  'Presentation only. Billing currency is whatever the order/listing carries.';

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "notification_preferences: owner manages own"
  on public.notification_preferences for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Notification senders run as service_role and need to honour the customer's
-- channel choice, so they read this table outside the owner's session.
create policy "notification_preferences: admin read"
  on public.notification_preferences for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- FX rates (display-only conversion)
--
-- Seeded ONLY with currencies that are formally pegged to the dollar, because
-- those are the only rates that are correct without a live feed. Floating
-- currencies (KES, ETB, TRY, EUR, and the Somali shilling) are deliberately
-- absent: the UI falls back to showing the original currency when no rate
-- exists, which is better than showing a number that was invented at migration
-- time and silently drifts.
-- ----------------------------------------------------------------------------
create table public.fx_rates (
  base_currency text not null check (length(base_currency) = 3),
  quote_currency text not null check (length(quote_currency) = 3),
  -- Units of quote_currency per 1 base_currency.
  rate numeric(18,6) not null check (rate > 0),
  source text not null default 'manual',
  as_of date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (base_currency, quote_currency)
);

comment on table public.fx_rates is
  'Indicative rates for display-only price conversion. Never used to compute an amount actually charged.';

create trigger set_fx_rates_updated_at
  before update on public.fx_rates
  for each row execute function public.set_updated_at();

alter table public.fx_rates enable row level security;

create policy "fx_rates: public read"
  on public.fx_rates for select to anon, authenticated
  using (true);

create policy "fx_rates: admin manage"
  on public.fx_rates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.fx_rates (base_currency, quote_currency, rate, source) values
  ('USD', 'USD', 1.000000, 'identity'),
  -- Both pegs are set by the issuing central bank, not the market.
  ('USD', 'AED', 3.672500, 'peg'),
  ('USD', 'SAR', 3.750000, 'peg')
on conflict (base_currency, quote_currency) do nothing;

-- ----------------------------------------------------------------------------
-- Login history
--
-- Supabase keeps sessions in the `auth` schema, which PostgREST does not
-- expose, so "active sessions" cannot be listed from the client SDK. We record
-- our own sign-in events instead and pair the list with a global sign-out.
-- ----------------------------------------------------------------------------
create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Which portal the session was opened against (b2c / agent / partner / admin).
  portal text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index login_events_profile_idx on public.login_events (profile_id, created_at desc);

alter table public.login_events enable row level security;

-- Select + insert only. No update or delete policy exists for anyone: security
-- history that its subject can edit is not history. Pruning happens out of
-- band via service_role, which bypasses RLS.
create policy "login_events: owner reads own"
  on public.login_events for select to authenticated
  using (profile_id = auth.uid());

create policy "login_events: owner records own"
  on public.login_events for insert to authenticated
  with check (profile_id = auth.uid());

create policy "login_events: admin read"
  on public.login_events for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Account deletion requests
--
-- A request, not a delete. Bookings, invoices, and payment records carry legal
-- retention obligations, and a customer with a live Umrah booking cannot have
-- their identity vanish mid-trip. Staff action closes the loop.
-- ----------------------------------------------------------------------------
create type public.deletion_request_status as enum (
  'requested',
  'in_review',
  'completed',
  'rejected',
  'withdrawn'
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.deletion_request_status not null default 'requested',
  reason text,
  staff_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open request at a time, so the admin queue can't fill with duplicates
-- from a customer clicking twice.
create unique index account_deletion_requests_one_open_per_profile
  on public.account_deletion_requests (profile_id)
  where status in ('requested', 'in_review');

create trigger set_account_deletion_requests_updated_at
  before update on public.account_deletion_requests
  for each row execute function public.set_updated_at();

alter table public.account_deletion_requests enable row level security;

create policy "account_deletion_requests: owner reads own"
  on public.account_deletion_requests for select to authenticated
  using (profile_id = auth.uid());

create policy "account_deletion_requests: owner opens own"
  on public.account_deletion_requests for insert to authenticated
  with check (profile_id = auth.uid());

-- Same shape as booking_requests: the subject may withdraw, never resolve.
create policy "account_deletion_requests: owner withdraws own"
  on public.account_deletion_requests for update to authenticated
  using (profile_id = auth.uid() and status in ('requested', 'in_review'))
  with check (profile_id = auth.uid() and status = 'withdrawn');

create policy "account_deletion_requests: admin manage"
  on public.account_deletion_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
