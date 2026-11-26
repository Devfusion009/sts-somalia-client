alter table public.payment_cashbook drop constraint payment_cashbook_method_check;
alter table public.payment_cashbook add constraint payment_cashbook_method_check check(method in ('bank_transfer','mobile_money','waafi'));
create table public.agency_payment_collections (
 id uuid primary key,
 agency_id uuid not null references public.agencies(id),
 gateway_id uuid not null references public.agency_payment_gateways(id),
 credentials_encrypted text not null,
 environment text not null check(environment in ('sandbox','production')),
 amount_minor bigint not null check(amount_minor between 1 and 100000000),
 counterparty text not null check(length(counterparty) between 1 and 160),
 payer_phone text not null check(payer_phone ~ '^[1-9][0-9]{6,14}$'),
 status text not null default 'pending' check(status in ('pending','paid','failed')),
 result jsonb,
 transaction_id text,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 checked_at timestamptz,
 unique(gateway_id,transaction_id)
);
create index agency_collections_pending on public.agency_payment_collections(checked_at nulls first) where status='pending';
create index agency_collections_history on public.agency_payment_collections(agency_id,created_at desc);
alter table public.agency_payment_collections enable row level security;
revoke all on public.agency_payment_collections from anon,authenticated;
grant select,insert,update on public.agency_payment_collections to service_role;

create function public.begin_agency_collection(p_id uuid,p_gateway uuid,p_agency uuid,p_actor uuid,p_amount bigint,p_counterparty text,p_phone text)
returns boolean language plpgsql security definer set search_path=public as $$
declare g agency_payment_gateways; previous agency_payment_collections;
begin
 if not exists(select 1 from agency_members m join agencies a on a.id=m.agency_id where m.agency_id=p_agency and m.profile_id=p_actor and m.role_in_agency='owner' and m.status='active' and a.status='active') then raise exception 'Not permitted'; end if;
 select * into g from agency_payment_gateways where id=p_gateway and agency_id=p_agency and last_test_ok is true for share;
 if not found then raise exception 'Verify the agency gateway first'; end if;
 insert into agency_payment_collections(id,agency_id,gateway_id,credentials_encrypted,environment,amount_minor,counterparty,payer_phone,created_by)
 values(p_id,p_agency,p_gateway,g.credentials_encrypted,g.environment,p_amount,p_counterparty,p_phone,p_actor) on conflict(id) do nothing;
 if found then return true; end if;
 select * into previous from agency_payment_collections where id=p_id;
 if previous.agency_id<>p_agency or previous.gateway_id<>p_gateway or previous.amount_minor<>p_amount or previous.payer_phone<>p_phone or previous.counterparty<>p_counterparty then raise exception 'Payment reference already used'; end if;
 return false;
end $$;

create function public.settle_agency_collection(p_id uuid,p_transaction text,p_amount bigint,p_currency text)
returns void language plpgsql security definer set search_path=public as $$
declare c agency_payment_collections;
begin
 select * into c from agency_payment_collections where id=p_id for update;
 if not found or p_amount<>c.amount_minor or p_currency<>'USD' or coalesce(p_transaction,'') in ('','0') then raise exception 'Payment verification mismatch'; end if;
 if c.status='paid' then
  if c.transaction_id<>p_transaction then raise exception 'Transaction reference mismatch'; end if;
  return;
 end if;
 -- Sandbox receipts remain test records and never enter the real cashbook.
 if c.environment='production' then
  insert into payment_cashbook(id,agency_id,direction,kind,amount_minor,currency,method,counterparty,external_reference,recorded_by)
  values(c.id,c.agency_id,'in','transfer',c.amount_minor,'USD','waafi',c.counterparty,p_transaction,c.created_by);
 end if;
 update agency_payment_collections set status='paid',transaction_id=p_transaction where id=c.id;
end $$;
revoke all on function public.begin_agency_collection(uuid,uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.settle_agency_collection(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.begin_agency_collection(uuid,uuid,uuid,uuid,bigint,text,text) to service_role;
grant execute on function public.settle_agency_collection(uuid,text,bigint,text) to service_role;
