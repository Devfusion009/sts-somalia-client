-- Credential access and manual cashbook writes are server-only. These records
-- never settle orders or change wallet balances.
create table public.agency_payment_gateways (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id),
  provider text not null check (provider = 'waafi'),
  environment text not null check (environment in ('sandbox', 'production')),
  credentials_encrypted text not null,
  version uuid not null default gen_random_uuid(),
  last_test_ok boolean,
  last_tested_at timestamptz,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(agency_id, provider, environment)
);
create table public.payment_cashbook (
  id uuid primary key,
  agency_id uuid references public.agencies(id),
  direction text not null check(direction in ('in', 'out')),
  kind text not null check(kind in ('transfer', 'refund')),
  amount_minor bigint not null check(amount_minor > 0 and amount_minor <= 100000000),
  currency text not null check(currency = 'USD'),
  method text not null check(method in ('bank_transfer', 'mobile_money')),
  counterparty text not null check(length(counterparty) between 1 and 160),
  external_reference text not null check(length(external_reference) between 1 and 120),
  original_id uuid references public.payment_cashbook(id),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check((kind = 'refund' and direction = 'out' and original_id is not null) or (kind = 'transfer' and original_id is null))
);
create index payment_cashbook_scope_date on public.payment_cashbook(agency_id, created_at desc);
create index payment_cashbook_refunds on public.payment_cashbook(original_id) where original_id is not null;
create unique index payment_cashbook_reference on public.payment_cashbook(coalesce(agency_id, '00000000-0000-0000-0000-000000000000'::uuid), method, direction, external_reference);
alter table public.agency_payment_gateways enable row level security;
alter table public.payment_cashbook enable row level security;
revoke all on public.agency_payment_gateways, public.payment_cashbook from anon, authenticated;
grant select, insert, update on public.agency_payment_gateways to service_role;
grant select, insert on public.payment_cashbook to service_role;

-- Lock the original receipt before calculating remaining refundable funds.
create function public.record_cashbook_entry(p_id uuid, p_agency_id uuid, p_direction text, p_kind text,
  p_amount_minor bigint, p_method text, p_counterparty text, p_reference text, p_original_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare original payment_cashbook; refunded bigint;
begin
  if p_agency_id is null then
    if not exists(select 1 from profiles where id = p_actor and is_platform_admin) then raise exception 'Not permitted'; end if;
  elsif not exists(select 1 from agency_members m join agencies a on a.id = m.agency_id
    where m.agency_id = p_agency_id and m.profile_id = p_actor and m.status = 'active'
    and m.role_in_agency = 'owner' and a.status = 'active') then raise exception 'Not permitted'; end if;
  if exists(select 1 from payment_cashbook where id = p_id and agency_id is not distinct from p_agency_id and recorded_by = p_actor) then return p_id; end if;
  if p_kind = 'refund' then
    select * into original from payment_cashbook where id = p_original_id and agency_id is not distinct from p_agency_id for update;
    if not found or original.direction <> 'in' then raise exception 'Original receipt not found'; end if;
    select coalesce(sum(amount_minor),0) into refunded from payment_cashbook where original_id = original.id;
    if p_amount_minor > original.amount_minor - refunded then raise exception 'Refund exceeds remaining receipt amount'; end if;
  end if;
  insert into payment_cashbook(id,agency_id,direction,kind,amount_minor,currency,method,counterparty,external_reference,original_id,recorded_by)
    values(p_id,p_agency_id,p_direction,p_kind,p_amount_minor,'USD',p_method,p_counterparty,p_reference,p_original_id,p_actor);
  return p_id;
end $$;
revoke all on function public.record_cashbook_entry(uuid,uuid,text,text,bigint,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.record_cashbook_entry(uuid,uuid,text,text,bigint,text,text,text,uuid,uuid) to service_role;
