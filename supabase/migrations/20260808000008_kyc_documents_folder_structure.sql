-- ============================================================================
-- Reorganizes kyc-documents storage from a flat, uid-prefixed filename
-- (uid/agency-<id>-<dockey>-<timestamp>-<name>) into real nested folders
-- keyed by the application record — the same pattern already proven for
-- visa-documents in this codebase:
--
--   kyc-documents/{application_type}/{application_id}/{doc_key}/{filename}
--
-- Every document type gets its own folder, everything for one application
-- (one prospective partner organization) lives under one path, and access
-- is enforced relationally (owns the application, or admin) rather than by
-- string-matching the uploader's uid — so it stays retrievable and
-- consistent even as team members change.
-- ============================================================================

drop policy if exists "kyc_documents: applicant reads own folder" on storage.objects;
drop policy if exists "kyc_documents: applicant writes own folder" on storage.objects;
drop policy if exists "kyc_documents: admin manage" on storage.objects;

create policy "kyc_documents: applicant reads own application folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'affiliate' and exists (
        select 1 from public.affiliate_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
    )
  );

create policy "kyc_documents: applicant writes own application folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'affiliate' and exists (
        select 1 from public.affiliate_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
    )
  );

create policy "kyc_documents: applicant deletes own application folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'affiliate' and exists (
        select 1 from public.affiliate_applications a
        where a.id::text = (storage.foldername(name))[2] and a.applicant_id = auth.uid()
      ))
    )
  );

create policy "kyc_documents: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'kyc-documents' and public.is_admin())
  with check (bucket_id = 'kyc-documents' and public.is_admin());
