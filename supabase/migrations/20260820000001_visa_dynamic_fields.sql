-- Adds the fields the admin Visa Catalog was still missing: an internal-only
-- processing fee (separate from the customer-facing price), eligibility
-- requirements + terms & conditions text shown to customers, and a
-- structured per-visa-type list of custom application questions. Also adds
-- the matching answers column on visa_applications.
--
-- No RLS changes needed: visa_types/visa_applications already have
-- is_admin()-gated write policies and public-read-when-published policies
-- that apply to whole rows, so these new columns inherit them automatically.

alter table public.visa_types
  add column processing_fee numeric(10, 2),
  add column eligibility_requirements text,
  add column terms_and_conditions text,
  add column application_questions jsonb not null default '[]'::jsonb;

alter table public.visa_applications
  add column custom_answers jsonb not null default '{}'::jsonb;
