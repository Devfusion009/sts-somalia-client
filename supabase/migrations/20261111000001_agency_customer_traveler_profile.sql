-- Agency customers carry a full traveler profile: identity, contact and
-- passport. Field set follows the Amadeus Flight Create Orders traveler
-- object (name, dateOfBirth, gender, contact, documents[PASSPORT]) so a
-- customer record can be mapped onto a GDS booking without re-asking.
-- Columns are nullable: existing customers predate the profile.

alter table public.agency_customers
  add column first_name text,
  add column middle_name text,
  add column last_name text,
  add column gender text check (gender in ('male', 'female')),
  add column date_of_birth date,
  add column nationality char(2),
  add column birth_place text,
  add column whatsapp text,
  add column address text,
  add column passport_number text,
  add column passport_issuing_country char(2),
  add column passport_issue_date date,
  add column passport_expiry_date date,
  add column passport_issuance_location text,
  add column passport_file_path text,
  add constraint agency_customers_passport_dates_check
    check (passport_issue_date is null or passport_expiry_date is null or passport_expiry_date > passport_issue_date);

create index agency_customers_passport_idx
  on public.agency_customers (agency_id, passport_number)
  where passport_number is not null;

-- customer-documents/{agency_id}/{filename} — private; any active member of
-- the agency reads and writes its own folder, admins read everything.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('customer-documents', 'customer-documents', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy "customer_documents: agency members read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and exists (
      select 1 from public.agency_members m
      where m.agency_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "customer_documents: agency members write own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-documents'
    and exists (
      select 1 from public.agency_members m
      where m.agency_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "customer_documents: agency members delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-documents'
    and exists (
      select 1 from public.agency_members m
      where m.agency_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "customer_documents: admin read"
  on storage.objects for select to authenticated
  using (bucket_id = 'customer-documents' and public.is_admin());
