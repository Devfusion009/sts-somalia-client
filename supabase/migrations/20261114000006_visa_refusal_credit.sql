-- Refused visas: the STS service fee becomes re-application credit.
--
-- The government fee is spent once STS files, so a refusal refunds nothing
-- in cash. The STS fee actually charged on the order (orders.fee_total) is
-- issued as credit for the same applicant, valid 12 months, taken off the
-- STS fee of their next visa application. A decision corrected away from
-- "refused" voids credit that hasn't been used.

create table public.visa_reapply_credits (
  id uuid primary key default gen_random_uuid(),
  source_application_id uuid not null unique references public.visa_applications (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  agency_customer_id uuid references public.agency_customers (id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null,
  status text not null default 'available' check (status in ('available', 'used', 'void')),
  used_application_id uuid references public.visa_applications (id),
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '12 months',
  created_at timestamptz not null default now()
);

create index visa_reapply_credits_owner_idx on public.visa_reapply_credits (profile_id, status);
create index visa_reapply_credits_agency_idx on public.visa_reapply_credits (agency_id, agency_customer_id, status);

alter table public.visa_reapply_credits enable row level security;

create policy "visa_reapply_credits: owner reads"
  on public.visa_reapply_credits for select to authenticated
  using (
    profile_id = auth.uid()
    or (agency_id is not null and public.is_agency_member(agency_id))
    or public.is_admin()
  );

revoke insert, update, delete on public.visa_reapply_credits from anon, authenticated;

/** Issues or voids credit as a case enters or leaves "rejected". */
create or replace function public.visa_refusal_credit_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
  v_currency text;
  v_profile uuid;
  v_credit public.visa_reapply_credits;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'rejected' then
    select o.fee_total, o.currency into v_fee, v_currency
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.visa_application_id = new.id
       and o.status in ('paid', 'partially_paid', 'processing', 'completed')
     order by o.created_at desc
     limit 1;
    if coalesce(v_fee, 0) <= 0 then
      return new;
    end if;
    v_profile := coalesce(new.applicant_profile_id, new.submitted_by);

    insert into public.visa_reapply_credits (
      source_application_id, profile_id, agency_id, agency_customer_id, amount, currency
    ) values (new.id, v_profile, new.agency_id, new.agency_customer_id, v_fee, v_currency)
    on conflict (source_application_id) do update
      set status = 'available', amount = excluded.amount, expires_at = now() + interval '12 months'
      where public.visa_reapply_credits.status = 'void'
    returning * into v_credit;

    if v_credit.id is not null then
      insert into public.notifications (profile_id, type, title, body, data)
      select distinct p, 'visa_refusal_credit', 'Re-application credit added',
             v_currency || ' ' || to_char(v_fee, 'FM999999990.00')
               || ' credit for ' || new.application_ref || ', applied to the STS fee of your next visa application within 12 months.',
             jsonb_build_object('applicationId', new.id, 'applicationRef', new.application_ref, 'agencyId', new.agency_id)
        from unnest(array[new.submitted_by, new.applicant_profile_id]) as p
       where p is not null;
    end if;
  elsif old.status = 'rejected' then
    update public.visa_reapply_credits
       set status = 'void'
     where source_application_id = new.id and status = 'available';
  end if;
  return new;
end;
$$;

revoke execute on function public.visa_refusal_credit_sync() from public, anon, authenticated;

create trigger visa_applications_refusal_credit
  after update of status on public.visa_applications
  for each row execute function public.visa_refusal_credit_sync();

/**
 * Reserves the oldest available credit for this applicant against a new
 * application; returns the amount (0 when none). Same applicant means the
 * same agency customer for a desk booking, otherwise the same profile.
 */
create or replace function public.visa_claim_reapply_credit(p_application_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_credit public.visa_reapply_credits;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found or app.submitted_by is distinct from auth.uid() then
    raise exception 'visa application not found';
  end if;
  -- Already reserved for this application (a retried submit).
  select * into v_credit from public.visa_reapply_credits where used_application_id = app.id and status = 'used';
  if found then
    return v_credit.amount;
  end if;

  select * into v_credit
    from public.visa_reapply_credits c
   where c.status = 'available'
     and c.expires_at > now()
     and c.currency = app.currency
     and c.source_application_id <> app.id
     and (
       (app.agency_customer_id is not null and c.agency_customer_id = app.agency_customer_id)
       or (app.agency_customer_id is null and c.agency_customer_id is null
           and c.profile_id = coalesce(app.applicant_profile_id, app.submitted_by))
     )
   order by c.created_at
   limit 1
   for update skip locked;
  if not found then
    return 0;
  end if;

  update public.visa_reapply_credits
     set status = 'used', used_application_id = app.id, used_at = now()
   where id = v_credit.id;
  return v_credit.amount;
end;
$$;

/** Puts a reserved credit back when the order for its application failed. */
create or replace function public.visa_release_reapply_credit(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.visa_applications where id = p_application_id and submitted_by = auth.uid()) then
    raise exception 'visa application not found';
  end if;
  if exists (select 1 from public.order_items where visa_application_id = p_application_id) then
    return;
  end if;
  update public.visa_reapply_credits
     set status = 'available', used_application_id = null, used_at = null
   where used_application_id = p_application_id and status = 'used';
end;
$$;

revoke execute on function public.visa_claim_reapply_credit(uuid) from public, anon;
revoke execute on function public.visa_release_reapply_credit(uuid) from public, anon;
grant execute on function public.visa_claim_reapply_credit(uuid) to authenticated;
grant execute on function public.visa_release_reapply_credit(uuid) to authenticated;

/**
 * "Apply again" after a refusal: a new draft for the same visa type with
 * the applicant, contact, travel and member details copied. Documents are
 * uploaded fresh (the refusal often turns on them).
 */
create or replace function public.visa_reapply(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.visa_applications;
  v_new uuid;
begin
  select * into src from public.visa_applications where id = p_application_id;
  if not found or (src.submitted_by is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'visa application not found';
  end if;
  if src.status <> 'rejected' then
    raise exception 'only a refused application can be re-applied';
  end if;

  insert into public.visa_applications (
    visa_type_id, submitted_by, applicant_profile_id, agency_id, agency_customer_id,
    applicant_type, traveler_details, contact_details, travel_details, custom_answers, status, current_step
  ) values (
    src.visa_type_id, src.submitted_by, src.applicant_profile_id, src.agency_id, src.agency_customer_id,
    src.applicant_type, src.traveler_details, src.contact_details,
    src.travel_details - 'arrival_date' - 'departure_date', src.custom_answers, 'draft', 1
  )
  returning id into v_new;

  insert into public.visa_members (
    application_id, full_name, relationship, date_of_birth, nationality, passport_number, passport_expiry,
    is_primary, sort_order, details
  )
  select v_new, m.full_name, m.relationship, m.date_of_birth, m.nationality, m.passport_number, m.passport_expiry,
         m.is_primary, m.sort_order, m.details
    from public.visa_members m
   where m.application_id = src.id;

  return v_new;
end;
$$;

revoke execute on function public.visa_reapply(uuid) from public, anon;
grant execute on function public.visa_reapply(uuid) to authenticated;
