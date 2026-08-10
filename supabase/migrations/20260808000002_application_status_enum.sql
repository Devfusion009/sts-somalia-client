-- Split from 20260808000003 on purpose: a newly-added enum value can't be
-- used in a comparison expression (e.g. inside a policy's USING/WITH CHECK)
-- within the same transaction it was added — Postgres raises "unsafe use of
-- new value" (SQLSTATE 55P04). Each Supabase migration file runs as one
-- transaction, so the ADD VALUE statements must ship in their own file,
-- committed, before anything references 'draft'/'under_review'/
-- 'more_info_requested'.
alter type public.application_status add value 'draft';
alter type public.application_status add value 'under_review';
alter type public.application_status add value 'more_info_requested';
