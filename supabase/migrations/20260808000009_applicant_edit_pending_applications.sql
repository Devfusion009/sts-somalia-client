-- ============================================================================
-- Extends applicant self-edit to 'pending' and 'under_review' applications
-- (previously only 'draft'/'more_info_requested' were editable — anything
-- already submitted was locked, so mistakes could only be fixed by an admin
-- kicking it back via "Request more info"). Applicants can now fix their
-- own submission any time before a final decision (approved/rejected);
-- editing while under_review resets status to 'pending' via
-- submitApplication, which naturally re-surfaces it in the admin queue as
-- "changed since last look."
-- ============================================================================

drop policy if exists "agency_applications: applicant edits own draft or more-info" on public.agency_applications;
create policy "agency_applications: applicant edits own unless decided"
  on public.agency_applications for update to authenticated
  using (applicant_id = auth.uid() and status in ('draft', 'more_info_requested', 'pending', 'under_review'))
  with check (applicant_id = auth.uid() and status in ('draft', 'more_info_requested', 'pending', 'under_review'));

drop policy if exists "hotel_partner_applications: applicant edits own draft or more-info" on public.hotel_partner_applications;
create policy "hotel_partner_applications: applicant edits own unless decided"
  on public.hotel_partner_applications for update to authenticated
  using (applicant_id = auth.uid() and status in ('draft', 'more_info_requested', 'pending', 'under_review'))
  with check (applicant_id = auth.uid() and status in ('draft', 'more_info_requested', 'pending', 'under_review'));

drop policy if exists "affiliate_applications: applicant edits own draft or more-info" on public.affiliate_applications;
create policy "affiliate_applications: applicant edits own unless decided"
  on public.affiliate_applications for update to authenticated
  using (applicant_id = auth.uid() and status in ('draft', 'more_info_requested', 'pending', 'under_review'))
  with check (applicant_id = auth.uid() and status in ('draft', 'more_info_requested', 'pending', 'under_review'));
