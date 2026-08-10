-- ============================================================================
-- Agency profile settings: logo storage + owner/admin can edit the agency's
-- own profile (name, contact info, logo), not just the wallet/markup/team
-- surfaces Phase 1 already covered.
-- ============================================================================

alter table public.agencies add column logo_path text;

-- The original Phase-1-era "agencies: owner update own agency" policy used
-- is_agency_owner() (strictly role = 'owner'). Widen to owner+admin, matching
-- the same owner+admin model every other agency-management surface uses
-- (see "agency_markups: owner or admin manages own" in 20260807000001).
drop policy "agencies: owner update own agency" on public.agencies;

create policy "agencies: owner or admin update own agency"
  on public.agencies for update
  to authenticated
  using (public.is_agency_owner_or_admin(id))
  with check (public.is_agency_owner_or_admin(id));

insert into storage.buckets (id, name, public) values
  ('agency-logos', 'agency-logos', true)
on conflict (id) do nothing;

-- agency-logos/{agency_id}/filename — public read (displayed on invoices,
-- portal chrome, etc.), owner/admin of that agency writes; same shape as the
-- hotel-images bucket's per-owner-folder policy.
create policy "agency_logos: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'agency-logos');

-- Compares agency_members.agency_id::text to the folder segment (not the
-- reverse cast) so a malformed folder name fails the policy quietly instead
-- of raising an "invalid input syntax for type uuid" error — same style as
-- the hotel_images/visa_documents policies above.
create policy "agency_logos: owner or admin writes own agency folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-logos'
    and exists (
      select 1 from public.agency_members m
      where m.agency_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.role_in_agency in ('owner', 'admin')
        and m.status = 'active'
    )
  );

create policy "agency_logos: owner or admin manages own agency folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agency-logos'
    and exists (
      select 1 from public.agency_members m
      where m.agency_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.role_in_agency in ('owner', 'admin')
        and m.status = 'active'
    )
  );

create policy "agency_logos: owner or admin deletes own agency folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-logos'
    and exists (
      select 1 from public.agency_members m
      where m.agency_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.role_in_agency in ('owner', 'admin')
        and m.status = 'active'
    )
  );

create policy "agency_logos: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'agency-logos' and public.is_admin())
  with check (bucket_id = 'agency-logos' and public.is_admin());
