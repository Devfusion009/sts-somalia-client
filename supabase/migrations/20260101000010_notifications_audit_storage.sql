-- ============================================================================
-- Notifications, Audit Log, and Storage Buckets
-- ============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: self reads own"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

create policy "notifications: self marks read"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "notifications: admin manage"
  on public.notifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Only expose read_at to direct client updates; everything else (title,
-- body, data) is system/admin-authored via SECURITY DEFINER paths or the
-- admin policy above.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ----------------------------------------------------------------------------
-- Append-only audit log for admin-visible history of sensitive changes.
-- No INSERT/UPDATE/DELETE grants to authenticated/anon: rows are written
-- exclusively by the SECURITY DEFINER trigger below (executes as table
-- owner) or directly by the service role.
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs: admin read"
  on public.audit_logs for select to authenticated
  using (public.is_admin());

create or replace function public.audit_log_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger orders_audit
  after insert or update or delete on public.orders
  for each row execute function public.audit_log_row_change();

create trigger hotel_bookings_audit
  after insert or update or delete on public.hotel_bookings
  for each row execute function public.audit_log_row_change();

create trigger flight_bookings_audit
  after insert or update or delete on public.flight_bookings
  for each row execute function public.audit_log_row_change();

create trigger umrah_bookings_audit
  after insert or update or delete on public.umrah_bookings
  for each row execute function public.audit_log_row_change();

create trigger visa_applications_audit
  after insert or update or delete on public.visa_applications
  for each row execute function public.audit_log_row_change();

create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function public.audit_log_row_change();

-- ============================================================================
-- Storage buckets
-- ============================================================================
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('hotel-images', 'hotel-images', true),
  ('umrah-images', 'umrah-images', true),
  ('kyc-documents', 'kyc-documents', false),
  ('visa-documents', 'visa-documents', false),
  ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- avatars/{profile_id}/filename — public read, owner writes their own folder
create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: owner writes own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner updates own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner deletes own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- hotel-images/{hotel_id}/filename — public read, owning partner writes
create policy "hotel_images: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'hotel-images');

create policy "hotel_images: partner writes own hotel folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hotel-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and public.is_hotel_partner_member(h.partner_id)
    )
  );

create policy "hotel_images: partner manages own hotel folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hotel-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and public.is_hotel_partner_member(h.partner_id)
    )
  );

create policy "hotel_images: partner deletes own hotel folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'hotel-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and public.is_hotel_partner_member(h.partner_id)
    )
  );

create policy "hotel_images: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'hotel-images' and public.is_admin())
  with check (bucket_id = 'hotel-images' and public.is_admin());

-- umrah-images/{package_id}/filename — public read, admin-managed only
create policy "umrah_images: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'umrah-images');

create policy "umrah_images: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'umrah-images' and public.is_admin())
  with check (bucket_id = 'umrah-images' and public.is_admin());

-- kyc-documents/{applicant_id}/filename — private, applicant + admin only
create policy "kyc_documents: applicant reads own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kyc_documents: applicant writes own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kyc_documents: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'kyc-documents' and public.is_admin())
  with check (bucket_id = 'kyc-documents' and public.is_admin());

-- visa-documents/{application_id}/filename — private, application owner/agency/admin
create policy "visa_documents_bucket: read via application access"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'visa-documents'
    and exists (
      select 1 from public.visa_applications a
      where a.id::text = (storage.foldername(name))[1]
        and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
             or (a.agency_id is not null and public.is_agency_member(a.agency_id))
             or public.is_admin())
    )
  );

create policy "visa_documents_bucket: submitter writes own application folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'visa-documents'
    and exists (
      select 1 from public.visa_applications a
      where a.id::text = (storage.foldername(name))[1] and a.submitted_by = auth.uid()
    )
  );

create policy "visa_documents_bucket: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'visa-documents' and public.is_admin())
  with check (bucket_id = 'visa-documents' and public.is_admin());

-- invoices/{order_id}/filename — private, generated server-side (service role)
create policy "invoices_bucket: read via order access"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[1])
    and public.can_access_order(((storage.foldername(name))[1])::uuid)
  );

create policy "invoices_bucket: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'invoices' and public.is_admin())
  with check (bucket_id = 'invoices' and public.is_admin());
