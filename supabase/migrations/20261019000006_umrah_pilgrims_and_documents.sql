-- Pilgrim details after booking, readiness, and customer document hand-in.
--
-- Passport number and expiry were optional at booking and nothing could ever
-- change a pilgrim row afterwards, so visas could not be filed from the
-- system. Customers had no way to hand over a passport scan or photo either.
--
-- 1. update_umrah_pilgrim: one door for pilgrim edits. Staff can always edit;
--    the customer, the booker and agency booking staff can edit while the
--    booking is at 'booked' or 'confirmed' (before visas are filed).
-- 2. umrah_pilgrim_readiness: what each pilgrim is still missing. The stage
--    function (20261019000007) refuses visa_processing while anything is
--    missing, when umrah_operations.visaRequiresPassport is on.
-- 3. Customer documents (passport copy, photo, vaccination, national ID) go
--    into umrah-documents/{booking_id}/customer/... and are reviewed by staff.

-- ----------------------------------------------------------------------------
-- 1. Pilgrim columns, policies, audit
-- ----------------------------------------------------------------------------
alter table public.umrah_pilgrims add column if not exists phone text;
alter table public.umrah_pilgrims add column if not exists passport_issue_country text;
alter table public.umrah_pilgrims add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_umrah_pilgrims_updated_at on public.umrah_pilgrims;
create trigger set_umrah_pilgrims_updated_at
  before update on public.umrah_pilgrims
  for each row execute function public.set_updated_at();

drop trigger if exists umrah_pilgrims_audit on public.umrah_pilgrims;
create trigger umrah_pilgrims_audit
  after update or delete on public.umrah_pilgrims
  for each row execute function public.audit_log_row_change();

-- Writes go through update_umrah_pilgrim now. Inserts stay open to the booker
-- while the booking is new, because the private-trip submit still adds its
-- pilgrims directly; group bookings add theirs inside create_umrah_group_booking.
drop policy if exists "umrah_pilgrims: booking owner manages pilgrims" on public.umrah_pilgrims;

drop policy if exists "umrah_pilgrims: admin manage" on public.umrah_pilgrims;
create policy "umrah_pilgrims: admin manage"
  on public.umrah_pilgrims for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "umrah_pilgrims: booker adds to new booking" on public.umrah_pilgrims;
create policy "umrah_pilgrims: booker adds to new booking"
  on public.umrah_pilgrims for insert to authenticated
  with check (exists (
    select 1 from public.umrah_bookings b
     where b.id = booking_id
       and b.booked_by = (select auth.uid())
       and b.status = 'pending'
       and b.fulfillment_stage = 'booked'
  ));

-- ----------------------------------------------------------------------------
-- 2. Who may hand in / edit for a booking
-- ----------------------------------------------------------------------------
-- The customer, the booker, or booking staff of the booking agency, while
-- the booking is live and visas have not been filed yet.
create or replace function public.umrah_booking_open_for_customer(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.umrah_bookings b
     where b.id = p_booking_id
       and b.status in ('pending', 'confirmed')
       and b.fulfillment_stage in ('booked', 'confirmed')
       and (b.customer_id = auth.uid()
            or b.booked_by = auth.uid()
            or b.agency_id = any (public.my_agency_booker_ids()))
  );
$$;

revoke execute on function public.umrah_booking_open_for_customer(uuid) from public, anon;
grant execute on function public.umrah_booking_open_for_customer(uuid) to authenticated;

create or replace function public.can_read_umrah_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.umrah_bookings b
     where b.id = p_booking_id
       and (b.customer_id = auth.uid()
            or b.booked_by = auth.uid()
            or b.agency_id = any (public.my_agency_ids()))
  );
$$;

revoke execute on function public.can_read_umrah_booking(uuid) from public, anon;
grant execute on function public.can_read_umrah_booking(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Edit a pilgrim
-- ----------------------------------------------------------------------------
create or replace function public.update_umrah_pilgrim(p_pilgrim_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.umrah_pilgrims;
  v_unknown text;
  v_name text;
begin
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'invalid pilgrim details';
  end if;

  select k into v_unknown
    from jsonb_object_keys(p_patch) k
   where k not in ('full_name', 'gender', 'date_of_birth', 'nationality', 'passport_number',
                   'passport_expiry', 'passport_issue_country', 'mahram_name', 'mahram_relation', 'phone')
   limit 1;
  if v_unknown is not null then
    raise exception 'unknown pilgrim field %', v_unknown;
  end if;

  select * into pl from public.umrah_pilgrims where id = p_pilgrim_id for update;
  if not found then
    raise exception 'pilgrim not found';
  end if;

  if not public.is_admin() then
    if not public.can_read_umrah_booking(pl.booking_id) then
      raise exception 'pilgrim not found';
    end if;
    if not public.umrah_booking_open_for_customer(pl.booking_id) then
      raise exception 'pilgrim details are locked while visas are processed';
    end if;
  end if;

  if p_patch ? 'full_name' then
    v_name := btrim(coalesce(p_patch ->> 'full_name', ''));
    if length(v_name) < 2 then
      raise exception 'enter the pilgrim''s full name';
    end if;
  end if;
  if p_patch ? 'gender' and coalesce(p_patch ->> 'gender', '') not in ('male', 'female') then
    raise exception 'choose a gender';
  end if;

  update public.umrah_pilgrims set
    full_name = case when p_patch ? 'full_name' then v_name else full_name end,
    gender = case when p_patch ? 'gender' then (p_patch ->> 'gender')::public.pilgrim_gender else gender end,
    date_of_birth = case when p_patch ? 'date_of_birth' then nullif(p_patch ->> 'date_of_birth', '')::date else date_of_birth end,
    nationality = case when p_patch ? 'nationality' then nullif(btrim(p_patch ->> 'nationality'), '') else nationality end,
    passport_number = case when p_patch ? 'passport_number' then nullif(upper(btrim(p_patch ->> 'passport_number')), '') else passport_number end,
    passport_expiry = case when p_patch ? 'passport_expiry' then nullif(p_patch ->> 'passport_expiry', '')::date else passport_expiry end,
    passport_issue_country = case when p_patch ? 'passport_issue_country' then nullif(btrim(p_patch ->> 'passport_issue_country'), '') else passport_issue_country end,
    mahram_name = case when p_patch ? 'mahram_name' then nullif(btrim(p_patch ->> 'mahram_name'), '') else mahram_name end,
    mahram_relation = case when p_patch ? 'mahram_relation' then nullif(btrim(p_patch ->> 'mahram_relation'), '') else mahram_relation end,
    phone = case when p_patch ? 'phone' then nullif(btrim(p_patch ->> 'phone'), '') else phone end
  where id = pl.id;
end;
$$;

revoke execute on function public.update_umrah_pilgrim(uuid, jsonb) from public, anon;
grant execute on function public.update_umrah_pilgrim(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Customer documents
-- ----------------------------------------------------------------------------
alter table public.umrah_booking_documents drop constraint if exists umrah_booking_documents_doc_type_check;
alter table public.umrah_booking_documents add constraint umrah_booking_documents_doc_type_check
  check (doc_type in ('visa', 'e_ticket', 'hotel_voucher', 'itinerary', 'insurance', 'other',
                      'passport_copy', 'photo', 'vaccination', 'national_id'));

alter table public.umrah_booking_documents
  add column if not exists source text not null default 'staff' check (source in ('staff', 'customer'));
alter table public.umrah_booking_documents
  add column if not exists review_status text not null default 'accepted'
    check (review_status in ('pending', 'accepted', 'rejected'));
alter table public.umrah_booking_documents add column if not exists review_note text;
alter table public.umrah_booking_documents add column if not exists reviewed_by uuid references public.profiles (id);
alter table public.umrah_booking_documents add column if not exists reviewed_at timestamptz;

drop policy if exists "umrah_booking_documents: owner adds own pilgrim documents" on public.umrah_booking_documents;
create policy "umrah_booking_documents: owner adds own pilgrim documents"
  on public.umrah_booking_documents for insert to authenticated
  with check (
    source = 'customer'
    and review_status = 'pending'
    and uploaded_by = (select auth.uid())
    and doc_type in ('passport_copy', 'photo', 'vaccination', 'national_id')
    and pilgrim_id is not null
    and storage_path like booking_id::text || '/customer/%'
    and public.umrah_booking_open_for_customer(booking_id)
    and exists (select 1 from public.umrah_pilgrims p where p.id = pilgrim_id and p.booking_id = umrah_booking_documents.booking_id)
  );

drop policy if exists "umrah_booking_documents: uploader removes pending" on public.umrah_booking_documents;
create policy "umrah_booking_documents: uploader removes pending"
  on public.umrah_booking_documents for delete to authenticated
  using (
    source = 'customer'
    and review_status = 'pending'
    and uploaded_by = (select auth.uid())
  );

-- Storage: umrah-documents/{booking_id}/customer/{pilgrim_id}/... only. Staff
-- files sit directly under {booking_id}/ and can never be written here.
drop policy if exists "umrah_documents_bucket: owner uploads" on storage.objects;
create policy "umrah_documents_bucket: owner uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'umrah-documents'
    and (storage.foldername(name))[2] = 'customer'
    and exists (
      select 1 from public.umrah_bookings b
       where b.id::text = (storage.foldername(name))[1]
         and public.umrah_booking_open_for_customer(b.id)
    )
  );

drop policy if exists "umrah_documents_bucket: owner removes own uploads" on storage.objects;
create policy "umrah_documents_bucket: owner removes own uploads"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'umrah-documents'
    and (storage.foldername(name))[2] = 'customer'
    and owner = (select auth.uid())
  );

-- Staff review of a handed-in document.
create or replace function public.review_umrah_document(p_document_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.umrah_booking_documents;
  bk public.umrah_bookings;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_order_id uuid;
  v_pilgrim text;
begin
  if not public.is_admin() then
    raise exception 'Only STS staff can review documents.';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Invalid decision.';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception 'Enter a reason.';
  end if;

  select * into d from public.umrah_booking_documents where id = p_document_id for update;
  if not found or d.source <> 'customer' then
    raise exception 'Document not found.';
  end if;

  update public.umrah_booking_documents
     set review_status = p_decision, review_note = v_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = d.id;

  if p_decision = 'rejected' then
    select * into bk from public.umrah_bookings where id = d.booking_id;
    select full_name into v_pilgrim from public.umrah_pilgrims where id = d.pilgrim_id;
    select o.id into v_order_id
      from public.order_items oi join public.orders o on o.id = oi.order_id
     where oi.umrah_booking_id = bk.id
     order by o.created_at desc limit 1;

    insert into public.notifications (profile_id, type, title, body, data)
    select distinct r.profile_id, 'umrah_document_rejected', 'Umrah document needs replacing',
           coalesce(v_pilgrim || ': ', '') || v_note,
           jsonb_build_object('bookingId', bk.id, 'orderId', v_order_id, 'documentId', d.id)
    from (
      select bk.customer_id as profile_id
      union select bk.booked_by
      union select m.profile_id from public.agency_members m
             where bk.agency_id is not null and m.agency_id = bk.agency_id and m.status = 'active'
    ) r
    where r.profile_id is not null;
  end if;
end;
$$;

revoke execute on function public.review_umrah_document(uuid, text, text) from public, anon;
grant execute on function public.review_umrah_document(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Readiness
-- ----------------------------------------------------------------------------
-- missing blocks visa filing; warnings never block (mahram for a girl under 18).
create or replace function public._umrah_pilgrim_readiness(p_booking_id uuid)
returns table (pilgrim_id uuid, missing text[], warnings text[])
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_departure date;
  v_required text[];
begin
  select coalesce(d.departure_date, cr.departure_date) into v_departure
    from public.umrah_bookings b
    left join public.umrah_package_departures d on d.id = b.departure_id
    left join public.umrah_custom_requests cr on cr.id = b.custom_request_id
   where b.id = p_booking_id;

  begin
    select coalesce(array_agg(x.doc_type), '{}') into v_required
      from jsonb_array_elements_text(coalesce(public.umrah_setting('requiredDocuments'), '[]'::jsonb)) as x(doc_type)
     where x.doc_type in ('passport_copy', 'photo', 'vaccination', 'national_id');
  exception when others then
    v_required := '{}';
  end;

  return query
  select p.id,
         array_remove(array[
           case when p.passport_number is null then 'passport_number' end,
           case when p.passport_expiry is null then 'passport_expiry' end,
           case when p.passport_expiry is not null and v_departure is not null
                     and p.passport_expiry < v_departure + interval '6 months'
                then 'passport_expires_too_soon' end,
           case when p.date_of_birth is null then 'date_of_birth' end,
           case when p.nationality is null then 'nationality' end
         ]::text[] || coalesce((
           select array_agg('document:' || req)
             from unnest(v_required) req
            where not exists (
              select 1 from public.umrah_booking_documents doc
               where doc.booking_id = p_booking_id
                 and doc.pilgrim_id = p.id
                 and doc.doc_type = req
                 and doc.review_status = 'accepted'
            )
         ), '{}'), null),
         array_remove(array[
           case when p.gender = 'female' and p.date_of_birth is not null and v_departure is not null
                     and p.date_of_birth > v_departure - interval '18 years'
                     and p.mahram_name is null
                then 'mahram_missing' end
         ]::text[], null)
    from public.umrah_pilgrims p
   where p.booking_id = p_booking_id
   order by p.full_name;
end;
$$;

revoke execute on function public._umrah_pilgrim_readiness(uuid) from public, anon, authenticated;

create or replace function public.umrah_pilgrim_readiness(p_booking_id uuid)
returns table (pilgrim_id uuid, missing text[], warnings text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_read_umrah_booking(p_booking_id) then
    return;
  end if;
  return query select * from public._umrah_pilgrim_readiness(p_booking_id);
end;
$$;

revoke execute on function public.umrah_pilgrim_readiness(uuid) from public, anon;
grant execute on function public.umrah_pilgrim_readiness(uuid) to authenticated;
