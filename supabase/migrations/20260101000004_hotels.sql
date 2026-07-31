-- ============================================================================
-- Hotel Partner Portal + Hotel/Room catalog + Hotel Bookings
-- ============================================================================

create type public.listing_status as enum ('draft', 'pending_review', 'published', 'suspended');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'refunded', 'no_show', 'failed');

create table public.hotel_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  contact_email citext not null,
  contact_phone text,
  country_code text,
  status public.agency_status not null default 'pending',
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_hotel_partners_updated_at
  before update on public.hotel_partners
  for each row execute function public.set_updated_at();

create table public.hotel_partner_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.hotel_partners (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_partner public.agency_member_role not null default 'staff',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (partner_id, profile_id)
);

create table public.hotel_partner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null,
  business_details jsonb not null default '{}'::jsonb,
  document_refs jsonb not null default '[]'::jsonb,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

create or replace function public.is_hotel_partner_member(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_partner_members
    where partner_id = target_partner_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_hotel_partner_owner(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_partner_members
    where partner_id = target_partner_id
      and profile_id = auth.uid()
      and role_in_partner = 'owner'
      and status = 'active'
  );
$$;

create or replace function public.approve_hotel_partner_application(application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.hotel_partner_applications;
  new_partner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve hotel partner applications';
  end if;

  select * into app from public.hotel_partner_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'application already processed';
  end if;

  insert into public.hotel_partners (name, contact_email, created_by, status)
  select app.business_name, p.email, app.applicant_id, 'active'
  from public.profiles p where p.id = app.applicant_id
  returning id into new_partner_id;

  insert into public.hotel_partner_members (partner_id, profile_id, role_in_partner, status)
  values (new_partner_id, app.applicant_id, 'owner', 'active');

  update public.hotel_partner_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'hotel_partner');

  return new_partner_id;
end;
$$;

create or replace function public.reject_hotel_partner_application(application_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can reject hotel partner applications';
  end if;

  update public.hotel_partner_applications
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = notes
    where id = application_id and status = 'pending';
end;
$$;

-- ----------------------------------------------------------------------------
-- Hotel catalog
-- ----------------------------------------------------------------------------
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.hotel_partners (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  star_rating smallint check (star_rating between 1 and 5),
  address_line text,
  city text not null,
  country_code text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  amenities jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hotels_partner_idx on public.hotels (partner_id);
create index hotels_city_idx on public.hotels (city);
create index hotels_status_idx on public.hotels (status);
create index hotels_name_trgm_idx on public.hotels using gin (name extensions.gin_trgm_ops);

create trigger set_hotels_updated_at
  before update on public.hotels
  for each row execute function public.set_updated_at();

create table public.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  name text not null,
  description text,
  max_occupancy smallint not null default 2,
  bed_type text,
  size_sqm numeric(6,2),
  amenities jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  base_price numeric(10,2) not null check (base_price >= 0),
  currency text not null default 'USD',
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hotel_rooms_hotel_idx on public.hotel_rooms (hotel_id);

create trigger set_hotel_rooms_updated_at
  before update on public.hotel_rooms
  for each row execute function public.set_updated_at();

-- Per-date availability & price overrides (channel-manager style inventory)
create table public.hotel_room_inventory (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.hotel_rooms (id) on delete cascade,
  date date not null,
  total_units integer not null check (total_units >= 0),
  booked_units integer not null default 0 check (booked_units >= 0),
  price_override numeric(10,2),
  unique (room_id, date)
);

create index hotel_room_inventory_date_idx on public.hotel_room_inventory (date);

create table public.hotel_bookings (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id),
  room_id uuid not null references public.hotel_rooms (id),
  customer_id uuid not null references public.profiles (id),
  booked_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  check_in date not null,
  check_out date not null check (check_out > check_in),
  num_rooms integer not null default 1 check (num_rooms > 0),
  num_adults integer not null default 1 check (num_adults > 0),
  num_children integer not null default 0 check (num_children >= 0),
  guest_details jsonb not null default '[]'::jsonb,
  special_requests text,
  status public.booking_status not null default 'pending',
  total_price numeric(10,2) not null check (total_price >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hotel_bookings_customer_idx on public.hotel_bookings (customer_id);
create index hotel_bookings_agency_idx on public.hotel_bookings (agency_id);
create index hotel_bookings_hotel_idx on public.hotel_bookings (hotel_id);

create trigger set_hotel_bookings_updated_at
  before update on public.hotel_bookings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.hotel_partners enable row level security;
alter table public.hotel_partner_members enable row level security;
alter table public.hotel_partner_applications enable row level security;
alter table public.hotels enable row level security;
alter table public.hotel_rooms enable row level security;
alter table public.hotel_room_inventory enable row level security;
alter table public.hotel_bookings enable row level security;

create policy "hotel_partners: members read own"
  on public.hotel_partners for select to authenticated
  using (public.is_hotel_partner_member(id));

create policy "hotel_partners: admin manage"
  on public.hotel_partners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_partners: owner update own"
  on public.hotel_partners for update to authenticated
  using (public.is_hotel_partner_owner(id)) with check (public.is_hotel_partner_owner(id));

create policy "hotel_partner_members: read own membership"
  on public.hotel_partner_members for select to authenticated
  using (profile_id = auth.uid());

create policy "hotel_partner_members: read teammates"
  on public.hotel_partner_members for select to authenticated
  using (public.is_hotel_partner_member(partner_id));

create policy "hotel_partner_members: admin manage"
  on public.hotel_partner_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_partner_members: owner invites staff"
  on public.hotel_partner_members for insert to authenticated
  with check (public.is_hotel_partner_owner(partner_id) and role_in_partner = 'staff');

create policy "hotel_partner_applications: applicant reads own"
  on public.hotel_partner_applications for select to authenticated
  using (applicant_id = auth.uid());

create policy "hotel_partner_applications: applicant submits"
  on public.hotel_partner_applications for insert to authenticated
  with check (applicant_id = auth.uid());

create policy "hotel_partner_applications: admin manage"
  on public.hotel_partner_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Public catalog: anyone (incl. anonymous website visitors) can browse
-- published listings; partners manage their own regardless of status.
create policy "hotels: public reads published"
  on public.hotels for select to anon, authenticated
  using (status = 'published');

create policy "hotels: partner manages own"
  on public.hotels for all to authenticated
  using (public.is_hotel_partner_member(partner_id))
  with check (public.is_hotel_partner_member(partner_id));

create policy "hotels: admin manage"
  on public.hotels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_rooms: public reads published hotel rooms"
  on public.hotel_rooms for select to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.hotels h where h.id = hotel_id and h.status = 'published')
  );

create policy "hotel_rooms: partner manages own"
  on public.hotel_rooms for all to authenticated
  using (exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)))
  with check (exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)));

create policy "hotel_rooms: admin manage"
  on public.hotel_rooms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_room_inventory: public reads"
  on public.hotel_room_inventory for select to anon, authenticated
  using (true);

create policy "hotel_room_inventory: partner manages own"
  on public.hotel_room_inventory for all to authenticated
  using (exists (
    select 1 from public.hotel_rooms r join public.hotels h on h.id = r.hotel_id
    where r.id = room_id and public.is_hotel_partner_member(h.partner_id)
  ))
  with check (exists (
    select 1 from public.hotel_rooms r join public.hotels h on h.id = r.hotel_id
    where r.id = room_id and public.is_hotel_partner_member(h.partner_id)
  ));

create policy "hotel_room_inventory: admin manage"
  on public.hotel_room_inventory for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_bookings: customer reads own"
  on public.hotel_bookings for select to authenticated
  using (customer_id = auth.uid() or booked_by = auth.uid());

create policy "hotel_bookings: agency reads its bookings"
  on public.hotel_bookings for select to authenticated
  using (agency_id is not null and public.is_agency_member(agency_id));

create policy "hotel_bookings: partner reads bookings for own hotels"
  on public.hotel_bookings for select to authenticated
  using (exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)));

create policy "hotel_bookings: admin manage"
  on public.hotel_bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_bookings: customer creates own booking"
  on public.hotel_bookings for insert to authenticated
  with check (booked_by = auth.uid() and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id))));

create policy "hotel_bookings: customer cancels own pending booking"
  on public.hotel_bookings for update to authenticated
  using ((customer_id = auth.uid() or booked_by = auth.uid()) and status = 'pending')
  with check (status in ('pending', 'cancelled'));

create policy "hotel_bookings: partner updates status for own hotels"
  on public.hotel_bookings for update to authenticated
  using (exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)))
  with check (exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)));
