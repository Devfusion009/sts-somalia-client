-- affiliate_applications has its own "notes" column (the applicant's notes on
-- submission) in addition to review_notes. The reject function's "notes"
-- parameter shares that name, so `review_notes = notes` inside the UPDATE is
-- ambiguous between the column and the parameter — Postgres raises
-- "column reference notes is ambiguous" on every affiliate rejection.
-- Qualifying the parameter with the function name resolves it without
-- touching the RPC signature (still called with a `notes` argument from the
-- app, shared generically across all four reject_* RPCs).
create or replace function public.reject_affiliate_application(application_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can reject affiliate applications';
  end if;

  update public.affiliate_applications
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = reject_affiliate_application.notes
    where id = application_id and status = 'pending';
end;
$$;
