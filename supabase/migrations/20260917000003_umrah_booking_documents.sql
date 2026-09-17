-- Per-booking travel documents for Umrah: the issued visa, e-tickets, hotel
-- vouchers and itinerary that staff hand a pilgrim before departure. There was
-- nowhere to put them — the 'documents_ready' stage (20260917000002) needs
-- something behind it.
--
-- Staff upload; customers, whoever booked, and the booking agency only read.
-- Files live in a private bucket keyed by booking id, the same layout as
-- visa-documents/{application_id}/..., so the storage policy can authorise
-- from the path alone.

create table public.umrah_booking_documents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.umrah_bookings (id) on delete cascade,
  -- Null for documents covering the whole group (itinerary, group voucher).
  pilgrim_id uuid references public.umrah_pilgrims (id) on delete set null,
  doc_type text not null
    check (doc_type in ('visa', 'e_ticket', 'hotel_voucher', 'itinerary', 'insurance', 'other')),
  title text not null,
  storage_path text not null,
  file_name text,
  file_size int,
  content_type text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index umrah_booking_documents_booking_idx
  on public.umrah_booking_documents (booking_id, created_at);

alter table public.umrah_booking_documents enable row level security;

create policy "umrah_booking_documents: admin manage"
  on public.umrah_booking_documents for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "umrah_booking_documents: read via parent booking"
  on public.umrah_booking_documents for select to authenticated
  using (
    exists (
      select 1 from public.umrah_bookings b
      where b.id = umrah_booking_documents.booking_id
        and (b.customer_id = auth.uid() or b.booked_by = auth.uid()
             or (b.agency_id is not null and public.is_agency_member(b.agency_id)))
    )
  );

-- ----------------------------------------------------------------------------
-- Storage: umrah-documents/{booking_id}/filename — private
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('umrah-documents', 'umrah-documents', false)
on conflict (id) do nothing;

create policy "umrah_documents_bucket: read via booking access"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'umrah-documents'
    and exists (
      select 1 from public.umrah_bookings b
      where b.id::text = (storage.foldername(name))[1]
        and (b.customer_id = auth.uid() or b.booked_by = auth.uid()
             or (b.agency_id is not null and public.is_agency_member(b.agency_id))
             or public.is_admin())
    )
  );

create policy "umrah_documents_bucket: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'umrah-documents' and public.is_admin())
  with check (bucket_id = 'umrah-documents' and public.is_admin());

-- umrah_pilgrims already has "read via parent booking" covering customer,
-- booker, agency members and admins (20260101000007), so no pilgrim policy is
-- added here.
