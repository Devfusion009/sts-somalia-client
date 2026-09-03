-- ============================================================================
-- Optional organization logo on the partner-applications wizard (agency /
-- hotel_partner / venue_partner — not affiliate, which is an individual, not
-- a business). A separate public bucket from kyc-documents deliberately: a
-- logo is a branding asset meant to be displayed, not a private compliance
-- document requiring a signed URL and an admin verify/reject workflow, so it
-- doesn't belong in document_refs. Path convention mirrors kyc-documents'
-- own {application_type}/{application_id}/filename shape (20260808000008).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

create policy "partner_logos: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'partner-logos');

create policy "partner_logos: applicant writes own application folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'partner-logos'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'venue_partner' and exists (
        select 1 from public.venue_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
    )
  );

create policy "partner_logos: applicant updates own application folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'partner-logos'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'venue_partner' and exists (
        select 1 from public.venue_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
    )
  );

create policy "partner_logos: applicant deletes own application folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'partner-logos'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'venue_partner' and exists (
        select 1 from public.venue_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
    )
  );

create policy "partner_logos: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'partner-logos' and public.is_admin())
  with check (bucket_id = 'partner-logos' and public.is_admin());
