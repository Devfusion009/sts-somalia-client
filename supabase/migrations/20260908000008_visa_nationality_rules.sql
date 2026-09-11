-- Nationality-aware pricing and requirements (D1, locked with the client
-- 08 Sep 2026 — nationality-aware, not flat).
--
-- Until now a visa_types row was one destination + category with a single
-- flat price/document list for every passport. A Somali and a Kenyan
-- applicant were quoted identically for the same UAE tourist visa, which is
-- not how visas work. This adds an override layer keyed by (visa type,
-- nationality); a visa type with no rules for a given nationality behaves
-- exactly as it always has — existing data (including the UAE Tourist Visa,
-- which has real orders against it) is untouched.

create table public.visa_nationality_rules (
  id uuid primary key default gen_random_uuid(),
  visa_type_id uuid not null references public.visa_types (id) on delete cascade,
  nationality_code text not null,
  -- null on any of these means "inherit the visa type's own value" — a rule
  -- only needs to state what's actually different for this nationality.
  price numeric(10,2) check (price is null or price >= 0),
  processing_fee numeric(10,2) check (processing_fee is null or processing_fee >= 0),
  processing_days_min smallint,
  processing_days_max smallint,
  required_documents jsonb,
  eligibility_requirements text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visa_type_id, nationality_code)
);

create index visa_nationality_rules_visa_type_idx on public.visa_nationality_rules (visa_type_id);

alter table public.visa_nationality_rules enable row level security;

-- Same visibility as the visa type itself: a rule for an unpublished visa
-- type is nobody's business but staff's.
create policy "visa_nationality_rules: public reads for published visa types"
  on public.visa_nationality_rules for select to anon, authenticated
  using (exists (
    select 1 from public.visa_types vt
    where vt.id = visa_type_id and vt.status = 'published'
  ));

create policy "visa_nationality_rules: admin manage"
  on public.visa_nationality_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger set_visa_nationality_rules_updated_at
  before update on public.visa_nationality_rules
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- The one place "what does this visa type actually cost/require for this
-- nationality" gets decided — a rule's non-null fields override, everything
-- else falls back to the visa type's own value. Read-only, callable by
-- anyone (browse/detail pages preview pricing before an application even
-- exists), and re-used by the wizard action below to freeze a snapshot.
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
  where vt.id = p_visa_type_id;
$$;

-- ----------------------------------------------------------------------------
-- What the applicant was actually quoted and assessed against — frozen once
-- their nationality is known (personal-info step), not re-derived on every
-- read. This is what makes a later edit to the rules harmless to an
-- application already in flight: nothing downstream re-resolves.
-- ----------------------------------------------------------------------------
alter table public.visa_applications
  add column resolved_price numeric(10,2),
  add column resolved_processing_fee numeric(10,2),
  add column resolved_processing_days_min smallint,
  add column resolved_processing_days_max smallint,
  add column resolved_documents jsonb,
  add column resolved_eligibility_requirements text;

comment on column public.visa_applications.resolved_documents is
  'Snapshot from resolve_visa_pricing() taken once nationality is known — the document wizard step and the completeness gate both trust this over visa_types.required_documents once it is set.';

-- ----------------------------------------------------------------------------
-- The M2 completeness gate must check against what this application was
-- actually told to provide, not the visa type's raw default — a nationality
-- rule can add or drop a required slot. Falls back to the visa type's own
-- list for any application that predates this column being populated.
-- Everything else about this function (M2, 20260908000003) is unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.visa_application_outstanding_items(p_application_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_missing text;
  v_rejected integer;
  v_requests integer;
begin
  select * into app from public.visa_applications where id = p_application_id;
  if not found then
    return 'application not found';
  end if;

  select string_agg(coalesce(nullif(btrim(slot->>'label'), ''), slot->>'key'), ', ')
    into v_missing
  from (
    select coalesce(app.resolved_documents, vt.required_documents) as docs
    from public.visa_types vt
    where vt.id = app.visa_type_id
  ) resolved
  cross join lateral jsonb_array_elements(coalesce(resolved.docs, '[]'::jsonb)) as slot
  where coalesce((slot->>'required')::boolean, false)
    and not exists (
      select 1
        from public.visa_documents d
       where d.application_id = p_application_id
         and d.document_type = slot->>'key'
         and d.review_status <> 'rejected'
    );
  if v_missing is not null then
    return 'missing documents: ' || v_missing;
  end if;

  select count(*) into v_rejected
    from public.visa_documents
   where application_id = p_application_id
     and review_status = 'rejected';
  if v_rejected > 0 then
    return v_rejected || ' rejected document(s) awaiting replacement';
  end if;

  select count(*) into v_requests
    from public.visa_document_requests
   where application_id = p_application_id
     and requirement = 'required'
     and status in ('requested', 'uploaded');
  if v_requests > 0 then
    return v_requests || ' outstanding document request(s)';
  end if;

  return null;
end;
$$;
