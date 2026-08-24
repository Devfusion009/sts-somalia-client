-- ============================================================================
-- Closes applicant self-edit 2 hours after submission.
--
-- 20260808000009 opened editing to 'pending'/'under_review' so an applicant
-- could fix their own mistake instead of waiting for an admin to kick the
-- application back. That left it open indefinitely: a reviewer could be
-- part-way through verifying a submission while the applicant changed the
-- very fields and documents being checked. A short grace window keeps the
-- original intent (fix a typo you spotted right after hitting submit) while
-- giving review a stable record to work against.
--
-- 'draft' and 'more_info_requested' stay editable with no time limit — both
-- mean the application is explicitly back in the applicant's hands.
--
-- The window is measured from submitted_at, which submitApplication()
-- preserves across re-submits, so re-submitting cannot extend it.
-- ============================================================================

-- One definition of the window, shared by all four application tables so
-- they cannot drift apart. Mirrored in TS by canApplicantEdit()
-- (modules/partner-applications/config.ts), which drives the UI only — this
-- is the rule that actually holds.
create or replace function public.applicant_can_edit(p_status text, p_submitted_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_status in ('draft', 'more_info_requested') then true
    when p_status in ('pending', 'under_review')
      then p_submitted_at is not null and p_submitted_at > now() - interval '2 hours'
    else false
  end;
$$;

drop policy if exists "agency_applications: applicant edits own unless decided" on public.agency_applications;
create policy "agency_applications: applicant edits own within edit window"
  on public.agency_applications for update to authenticated
  using (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at))
  with check (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at));

drop policy if exists "hotel_partner_applications: applicant edits own unless decided" on public.hotel_partner_applications;
create policy "hotel_partner_applications: applicant edits own within edit window"
  on public.hotel_partner_applications for update to authenticated
  using (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at))
  with check (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at));

drop policy if exists "affiliate_applications: applicant edits own unless decided" on public.affiliate_applications;
create policy "affiliate_applications: applicant edits own within edit window"
  on public.affiliate_applications for update to authenticated
  using (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at))
  with check (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at));

drop policy if exists "venue_partner_applications: applicant edits own unless decided" on public.venue_partner_applications;
create policy "venue_partner_applications: applicant edits own within edit window"
  on public.venue_partner_applications for update to authenticated
  using (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at))
  with check (applicant_id = auth.uid() and public.applicant_can_edit(status::text, submitted_at));
