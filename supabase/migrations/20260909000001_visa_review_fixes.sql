-- Fixes two real data-exposure bugs found by a code-review pass over the
-- whole visa module, plus one confusing-error bug in the admin document
-- actions. Both exposures are the identical class of mistake
-- 20260908000006 already fixed once (a SECURITY DEFINER function granted
-- EXECUTE to PUBLIC by default on creation, revoked from named roles but
-- never from PUBLIC itself) — these two functions were added earlier in the
-- same batch of work and simply weren't caught by that pass.

-- ----------------------------------------------------------------------------
-- 1) resolve_visa_pricing() never checked visa_types.status, so it quoted
-- price/documents/eligibility for a DRAFT visa type to anyone who could call
-- the RPC with its id — a real bypass of "visa_types: public reads
-- published", proven live: a plain `select` on the draft row correctly
-- returned zero rows under anon, but the RPC returned its price anyway.
--
-- Gated on published OR admin, not just admin: this function is the
-- legitimate read path for the wizard resolving an in-progress application's
-- own visa type (savePersonalInfo, startVisaApplication), which must keep
-- working for ordinary customers, not only staff.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_visa_pricing(p_visa_type_id uuid, p_nationality_code text)
returns table (
  price numeric,
  processing_fee numeric,
  processing_days_min smallint,
  processing_days_max smallint,
  required_documents jsonb,
  eligibility_requirements text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(r.price, vt.price),
    coalesce(r.processing_fee, vt.processing_fee),
    coalesce(r.processing_days_min, vt.processing_days_min),
    coalesce(r.processing_days_max, vt.processing_days_max),
    coalesce(r.required_documents, vt.required_documents),
    coalesce(r.eligibility_requirements, vt.eligibility_requirements)
  from public.visa_types vt
  left join public.visa_nationality_rules r
    on r.visa_type_id = vt.id and r.nationality_code = upper(coalesce(p_nationality_code, ''))
  where vt.id = p_visa_type_id
    and (vt.status = 'published' or public.is_admin());
$$;

-- ----------------------------------------------------------------------------
-- 2) visa_application_outstanding_items() had no ownership check and no
-- revoke at all — any authenticated (or anon) caller could ask it about any
-- application's id and learn which documents are missing or rejected on an
-- application that isn't theirs. Grepping the whole web app confirms no
-- client code calls it via RPC — its only caller is
-- guard_visa_ready_for_processing's trigger, which runs inside
-- apply_visa_status_transition_internal's SECURITY DEFINER context (so it
-- executes as this function's owner regardless of grants). Revoking it
-- entirely, the same shape as apply_visa_status_transition_internal and
-- apply_visa_partner_status_update, is correct rather than adding an
-- ownership check: there is no legitimate direct caller to authorize.
-- ----------------------------------------------------------------------------
revoke execute on function public.visa_application_outstanding_items(uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) adminRequestDocument and adminReviewDocument each move a submitted
-- application to in_review before moving it to additional_info_required
-- (the transition map has no direct submitted -> additional_info_required
-- edge), but neither TypeScript call site checked the first RPC's error —
-- on a still-unpaid order (guard_visa_requires_payment_to_review,
-- 20260908000007), the first call fails silently and the second raises a
-- confusing "cannot move from submitted to additional_info_required" instead
-- of surfacing the real "not paid for yet" reason. Rather than patch two
-- TypeScript call sites with the same fragile two-step dance, the state
-- machine now owns the edge directly.
-- ----------------------------------------------------------------------------
create or replace function public.apply_visa_status_transition_internal(
  p_application_id uuid,
  p_status public.visa_status,
  p_actor uuid default null,
  p_note text default null
)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_visa_name text;
  v_note text := nullif(btrim(p_note), '');
  v_title text;
  v_body text;
  v_data jsonb;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found then
    raise exception 'visa application not found';
  end if;

  if app.status = p_status then
    return app.status;
  end if;

  if not (
    case app.status
      when 'draft' then p_status in ('submitted')
      -- Asking for documents (or rejecting one) is itself the act of
      -- reviewing, so 'submitted' can go straight to
      -- 'additional_info_required' without a human bumping it through
      -- 'in_review' first in a separate call.
      when 'submitted' then p_status in ('in_review', 'additional_info_required', 'cancelled')
      when 'in_review' then p_status in ('additional_info_required', 'ready_for_processing', 'rejected', 'cancelled')
      when 'additional_info_required' then p_status in ('in_review', 'cancelled')
      when 'ready_for_processing' then p_status in ('additional_info_required', 'processing', 'cancelled')
      when 'processing' then p_status in ('additional_info_required', 'approved', 'rejected', 'cancelled')
      when 'approved' then p_status in ('issued')
      else false
    end
  ) then
    raise exception 'a visa application cannot move from % to %', app.status, p_status;
  end if;

  perform set_config('sts.visa_transition', p_application_id::text, true);

  update public.visa_applications
     set status = p_status,
         decided_by = case when p_status in ('approved', 'rejected', 'issued')
                           then coalesce(p_actor, decided_by) else decided_by end,
         decided_at = case when p_status in ('approved', 'rejected', 'issued')
                           then now() else decided_at end,
         updated_at = now()
   where id = p_application_id;

  perform set_config('sts.visa_transition', '', true);

  if v_note is not null then
    update public.visa_application_status_history
       set note = v_note
     where id = (
       select id from public.visa_application_status_history
        where application_id = p_application_id and status = p_status
        order by created_at desc
        limit 1
     );
  end if;

  select name into v_visa_name from public.visa_types where id = app.visa_type_id;

  v_data := jsonb_build_object(
    'applicationId', p_application_id,
    'applicationRef', app.application_ref,
    'status', p_status::text,
    'agencyId', app.agency_id
  );

  v_title := case p_status
    when 'submitted' then 'Visa application submitted'
    when 'in_review' then 'Visa application under review'
    when 'additional_info_required' then 'Documents needed'
    when 'ready_for_processing' then 'Cleared for processing'
    when 'processing' then 'Visa processing started'
    when 'approved' then 'Visa approved'
    when 'rejected' then 'Visa rejected'
    when 'issued' then 'Visa issued'
    when 'cancelled' then 'Visa application cancelled'
    else 'Visa application updated'
  end;

  v_body := case p_status
    when 'submitted' then coalesce(v_visa_name, 'Visa') || ' — ' || app.application_ref || ' was submitted.'
    when 'in_review' then 'STS is reviewing ' || app.application_ref || '.'
    when 'additional_info_required' then 'More documents are needed for ' || app.application_ref || '.'
    when 'ready_for_processing' then app.application_ref || ' is cleared for processing.'
    when 'processing' then app.application_ref || ' is with the visa authority.'
    when 'approved' then app.application_ref || ' was approved.'
    when 'rejected' then app.application_ref || ' was rejected.'
    when 'issued' then 'The visa for ' || app.application_ref || ' is ready to download.'
    when 'cancelled' then app.application_ref || ' was cancelled.'
    else app.application_ref || ' changed status.'
  end || case when v_note is not null then ' ' || v_note else '' end;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, 'visa_status_changed', v_title, v_body, v_data
  from (
    select app.submitted_by as profile_id
    union
    select app.applicant_profile_id
    union
    select m.profile_id
      from public.agency_members m
     where app.agency_id is not null
       and m.agency_id = app.agency_id
       and m.status = 'active'
  ) r
  where r.profile_id is not null;

  if p_status = 'submitted' then
    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'visa_application_submitted',
           'New visa application',
           coalesce(v_visa_name, 'Visa') || ' — ' || app.application_ref || ' is waiting for review.',
           v_data
    from public.profiles p
    where p.is_platform_admin;
  end if;

  return p_status;
end;
$$;
