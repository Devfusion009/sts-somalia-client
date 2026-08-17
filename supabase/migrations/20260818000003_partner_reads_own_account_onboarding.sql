-- ============================================================================
-- A partner reading their own onboarding status
--
-- The partner-facing portals (/partner, /venue, /agent) were completely
-- silent about onboarding status: partner_accounts had ONLY an admin-manage
-- RLS policy, so a partner had no way to see (a) whether they were still
-- 'onboarding' vs 'live', or (b) which checklist items were outstanding —
-- even though that exact 5-item checklist was already fully computed and
-- displayed to admin (getPartnerAccount() in modules/admin/partner-accounts.ts).
-- That function uses the plain session-scoped Supabase client, not a
-- service-role bypass, so granting the owner read access here is enough to
-- let the SAME function be reused, unmodified, from the partner's own
-- portal layout — no parallel checklist-computation code needed.
--
-- Also fixes a smaller pre-existing gap noticed along the way:
-- partner_document_reviews' "applicant reads own" policy checked
-- agency/hotel_partner/affiliate applications but not venue_partner —
-- venue partners couldn't see their own KYC document review status/notes.
-- ============================================================================

create policy "partner_accounts: owner reads own"
  on public.partner_accounts for select
  to authenticated
  using (
    (type = 'agency' and public.is_agency_member(entity_id))
    or (type = 'hotel_partner' and public.is_hotel_partner_member(entity_id))
    or (type = 'venue_partner' and public.is_venue_partner_member(entity_id))
    or (type = 'affiliate' and public.is_affiliate_owner(entity_id))
  );

drop policy "partner_document_reviews: applicant reads own" on public.partner_document_reviews;

create policy "partner_document_reviews: applicant reads own"
  on public.partner_document_reviews for select
  to authenticated
  using (
    (application_type = 'agency' and exists (select 1 from public.agency_applications a where a.id = application_id and a.applicant_id = auth.uid()))
    or (application_type = 'hotel_partner' and exists (select 1 from public.hotel_partner_applications a where a.id = application_id and a.applicant_id = auth.uid()))
    or (application_type = 'affiliate' and exists (select 1 from public.affiliate_applications a where a.id = application_id and a.applicant_id = auth.uid()))
    or (application_type = 'venue_partner' and exists (select 1 from public.venue_partner_applications a where a.id = application_id and a.applicant_id = auth.uid()))
  );
