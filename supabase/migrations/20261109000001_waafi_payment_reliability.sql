-- Durable WaafiPay attempts and atomic settlement for orders and agency wallets.
create table public.waafi_payment_attempts (
  reference_id uuid primary key,
  order_id uuid references public.orders(id),
  topup_id uuid references public.agency_topup_requests(id),
  environment text not null check (environment in ('sandbox', 'production')),
  merchant_uid text not null,
  amount numeric not null check (amount > 0),
  currency text not null,
  status text not null default 'initiating' check (status in ('initiating', 'pending', 'succeeded', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  review_alerted_at timestamptz,
  check (num_nonnulls(order_id, topup_id) = 1)
);
create unique index waafi_one_active_order_payment on public.waafi_payment_attempts(order_id)
  where order_id is not null and status in ('initiating', 'pending');
create index waafi_pending_reconciliation on public.waafi_payment_attempts(checked_at nulls first, created_at)
  where status in ('initiating', 'pending');
alter table public.waafi_payment_attempts enable row level security;
-- Service role only: customers cannot reserve attempts, cache success or settle money.
revoke all on public.waafi_payment_attempts from anon, authenticated;
grant all on public.waafi_payment_attempts to service_role;

create table public.waafi_receipts (
  reference_id uuid primary key references public.waafi_payment_attempts(reference_id),
  environment text not null,
  merchant_uid text not null,
  transaction_id text not null,
  amount numeric not null,
  currency text not null,
  settled_at timestamptz not null default now(),
  unique(environment, merchant_uid, transaction_id)
);
alter table public.waafi_receipts enable row level security;
revoke all on public.waafi_receipts from anon, authenticated;
grant all on public.waafi_receipts to service_role;

create table public.waafi_webhook_events (
  environment text not null,
  merchant_uid text not null,
  event_id text not null,
  event_name text not null,
  reference_id text,
  transaction_id text,
  received_at timestamptz not null default now(),
  primary key(environment, merchant_uid, event_id)
);
alter table public.waafi_webhook_events enable row level security;
revoke all on public.waafi_webhook_events from anon, authenticated;
grant all on public.waafi_webhook_events to service_role;

create function public.begin_waafi_attempt(p_reference_id uuid, p_order_id uuid, p_topup_id uuid, p_environment text, p_merchant_uid text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.waafi_payment_attempts; v_amount numeric; v_currency text; v_remaining numeric; v_order_status text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorised'; end if;
  if num_nonnulls(p_order_id,p_topup_id) <> 1 then raise exception 'invalid payment target'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_order_id,p_topup_id)::text, 0));
  select * into a from public.waafi_payment_attempts where reference_id=p_reference_id for update;
  if found then
    if a.environment<>p_environment or a.merchant_uid<>p_merchant_uid
      or a.order_id is distinct from p_order_id or a.topup_id is distinct from p_topup_id then raise exception 'payment configuration changed'; end if;
    return jsonb_build_object('claimed',false,'result',a.result);
  end if;
  if p_order_id is not null then
    select amount,currency into v_amount,v_currency from public.payments
      where id=p_reference_id and order_id=p_order_id and provider='waafi' and status='processing';
    if not found then raise exception 'payment not available'; end if;
    select o.total,o.status into v_remaining,v_order_status from public.orders o where o.id=p_order_id for update;
    select v_remaining-coalesce(sum(amount),0) into v_remaining from public.payments where order_id=p_order_id and status='succeeded';
    if v_order_status not in ('pending_payment','held','partially_paid') or v_amount>v_remaining then
      return jsonb_build_object('claimed',false,'result',jsonb_build_object('type','error','message','The remaining balance changed. Refresh checkout.'));
    end if;
    if exists(select 1 from public.waafi_payment_attempts where order_id=p_order_id and status in ('initiating','pending')) then
      return jsonb_build_object('claimed',false,'result',jsonb_build_object('type','error','message','Another payment is awaiting confirmation.'));
    end if;
  else
    select amount,'USD' into v_amount,v_currency from public.agency_topup_requests
      where id=p_reference_id and id=p_topup_id and provider='waafi' and rail='online' and status='pending';
    if not found then raise exception 'top-up not available'; end if;
  end if;
  insert into public.waafi_payment_attempts(reference_id,order_id,topup_id,environment,merchant_uid,amount,currency)
    values(p_reference_id,p_order_id,p_topup_id,p_environment,p_merchant_uid,v_amount,upper(v_currency));
  return jsonb_build_object('claimed',true);
end $$;

create function public.record_waafi_attempt(p_reference_id uuid, p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorised'; end if;
  update public.waafi_payment_attempts set result=p_result,
    status=case when p_result->>'type'='error' then 'failed' else 'pending' end
    where reference_id=p_reference_id and status in ('initiating','pending');
end $$;

create function public.settle_waafi_transaction(p_reference_id uuid, p_environment text, p_merchant_uid text,
  p_transaction_id text, p_amount numeric, p_currency text, p_event_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.waafi_payment_attempts; r public.waafi_receipts;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorised'; end if;
  if p_event_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_environment||p_merchant_uid||p_event_id,1));
    if exists(select 1 from public.waafi_webhook_events where environment=p_environment and merchant_uid=p_merchant_uid
      and event_id=p_event_id and reference_id is distinct from p_reference_id::text) then raise exception 'webhook event already used'; end if;
  end if;
  select * into a from public.waafi_payment_attempts where reference_id=p_reference_id for update;
  if not found then raise exception 'payment attempt not found'; end if;
  if a.environment<>p_environment or a.merchant_uid<>p_merchant_uid or a.amount<>p_amount
    or a.currency<>upper(p_currency) or coalesce(p_transaction_id,'') in ('','0') then raise exception 'payment verification mismatch'; end if;
  select * into r from public.waafi_receipts where reference_id=p_reference_id;
  if found then
    if r.transaction_id<>p_transaction_id then raise exception 'different transaction already settled'; end if;
    if p_event_id is not null then
      insert into public.waafi_webhook_events(environment,merchant_uid,event_id,event_name,reference_id,transaction_id)
        values(p_environment,p_merchant_uid,p_event_id,'authorization',p_reference_id::text,p_transaction_id) on conflict do nothing;
    end if;
    return;
  end if;
  -- A late authorization after a reported failure is still real money received.
  -- Receipts prevent a transaction from settling a second reference.
  insert into public.waafi_receipts(reference_id,environment,merchant_uid,transaction_id,amount,currency)
    values(p_reference_id,p_environment,p_merchant_uid,p_transaction_id,p_amount,upper(p_currency));
  if a.topup_id is not null then
    update public.agency_topup_requests set status='pending' where id=a.topup_id and status='failed';
    perform public.settle_agency_topup(a.topup_id,p_transaction_id);
  else
    if exists(select 1 from public.orders where id=a.order_id and status in ('pending_payment','held','partially_paid')) then
      update public.payments set status='succeeded',provider_ref=p_transaction_id,
        method_label='EVC Plus / ZAAD / Sahal (WaafiPay)'
        where id=a.reference_id and provider='waafi' and status in ('processing','requires_action','failed');
      if not found then raise exception 'payment cannot be settled'; end if;
    else
      -- Record received funds without reopening a cancelled/expired booking.
      update public.payments set status='requires_action',provider_ref=p_transaction_id,
        instructions='Payment received; booking requires review.' where id=a.reference_id and provider='waafi';
      insert into public.notifications(profile_id,type,title,body,data)
        select id,'waafi_payment_review','WaafiPay payment requires review','Payment arrived after the order closed.',
          jsonb_build_object('orderId',a.order_id,'referenceId',p_reference_id) from public.profiles where is_platform_admin;
    end if;
  end if;
  update public.waafi_payment_attempts set status='succeeded',checked_at=now(),
    result=jsonb_build_object('type','success','providerRef',p_transaction_id) where reference_id=p_reference_id;
  if p_event_id is not null then
    insert into public.waafi_webhook_events(environment,merchant_uid,event_id,event_name,reference_id,transaction_id)
      values(p_environment,p_merchant_uid,p_event_id,'authorization',p_reference_id::text,p_transaction_id)
      on conflict do nothing;
  end if;
end $$;

create function public.fail_waafi_attempt(p_reference_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.waafi_payment_attempts;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorised'; end if;
  select * into a from public.waafi_payment_attempts where reference_id=p_reference_id for update;
  if not found or a.status='succeeded' then return; end if;
  if a.topup_id is not null then perform public.fail_agency_topup(a.topup_id,'Payment was not completed.');
  else update public.payments set status='failed' where id=a.reference_id and provider='waafi' and status in ('processing','requires_action'); end if;
  update public.waafi_payment_attempts set status='failed',checked_at=now(),
    result=jsonb_build_object('type','error','message','Payment was not completed.') where reference_id=p_reference_id;
end $$;

-- A resubmitted wallet form returns its original request rather than charging twice.
alter table public.agency_topup_requests add column idempotency_key uuid;
create unique index agency_topup_idempotency on public.agency_topup_requests(requested_by,idempotency_key)
  where idempotency_key is not null;
create function public.request_waafi_topup(p_agency_id uuid,p_amount numeric,p_method text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare req public.agency_topup_requests; v_id uuid;
begin
  if auth.uid() is null or p_idempotency_key is null or not public.is_agency_owner_or_admin(p_agency_id) then raise exception 'not authorised'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_idempotency_key::text,0));
  select * into req from public.agency_topup_requests where requested_by=auth.uid() and idempotency_key=p_idempotency_key;
  if found then
    if req.agency_id<>p_agency_id or req.amount<>p_amount or req.method<>p_method then raise exception 'payment attempt does not match'; end if;
    return req.id;
  end if;
  v_id:=public.request_agency_topup(p_agency_id,p_amount,'online',p_method,null,null,null,'waafi');
  update public.agency_topup_requests set idempotency_key=p_idempotency_key where id=v_id;
  return v_id;
end $$;

revoke all on function public.begin_waafi_attempt(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.record_waafi_attempt(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.settle_waafi_transaction(uuid,text,text,text,numeric,text,text) from public,anon,authenticated;
revoke all on function public.fail_waafi_attempt(uuid) from public,anon,authenticated;
revoke all on function public.request_waafi_topup(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.begin_waafi_attempt(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.record_waafi_attempt(uuid,jsonb) to service_role;
grant execute on function public.settle_waafi_transaction(uuid,text,text,text,numeric,text,text) to service_role;
grant execute on function public.fail_waafi_attempt(uuid) to service_role;
grant execute on function public.request_waafi_topup(uuid,numeric,text,uuid) to authenticated;

-- Refunds/reversals require finance review: never mistake them for incoming funds.
create function public.record_waafi_review_event(p_environment text,p_merchant_uid text,p_event_id text,
  p_event_name text,p_reference_id text,p_transaction_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inserted integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorised'; end if;
  if p_event_name not in ('refund','void') then raise exception 'invalid review event'; end if;
  insert into public.waafi_webhook_events(environment,merchant_uid,event_id,event_name,reference_id,transaction_id)
    values(p_environment,p_merchant_uid,p_event_id,p_event_name,p_reference_id,p_transaction_id) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into public.notifications(profile_id,type,title,body,data)
    select id,'waafi_payment_review','WaafiPay payment requires review',
      'A gateway refund or reversal was reported.',
      jsonb_build_object('referenceId',p_reference_id,'transactionId',p_transaction_id,'eventId',p_event_id)
      from public.profiles where is_platform_admin;
end $$;
revoke all on function public.record_waafi_review_event(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_waafi_review_event(text,text,text,text,text,text) to service_role;

create function public.guard_pending_waafi_topup_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.provider='waafi' and new.status='cancelled' and exists(
    select 1 from public.waafi_payment_attempts where topup_id=old.id and status in ('initiating','pending')
  ) then raise exception 'Payment confirmation pending.'; end if;
  return new;
end $$;
create trigger guard_pending_waafi_topup_cancellation before update of status on public.agency_topup_requests
  for each row execute function public.guard_pending_waafi_topup_cancellation();

create function public.flag_waafi_reconciliation(p_reference_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.waafi_payment_attempts;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorised'; end if;
  update public.waafi_payment_attempts set review_alerted_at=now() where reference_id=p_reference_id
    and status in ('initiating','pending') and created_at<now()-interval '15 minutes' and review_alerted_at is null
    returning * into a;
  if not found then return; end if;
  insert into public.notifications(profile_id,type,title,body,data)
    select id,'waafi_payment_review','WaafiPay payment requires review','Payment confirmation is overdue.',
      jsonb_build_object('referenceId',a.reference_id,'orderId',a.order_id,'topupId',a.topup_id)
      from public.profiles where is_platform_admin;
end $$;
revoke all on function public.flag_waafi_reconciliation(uuid) from public,anon,authenticated;
grant execute on function public.flag_waafi_reconciliation(uuid) to service_role;

-- Guard legacy/manual write paths as well as the new API: a WaafiPay receipt is mandatory.
create function public.guard_waafi_payment_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provider='waafi' and new.status='succeeded' and not exists(
    select 1 from public.waafi_receipts where reference_id=new.id and amount=new.amount
      and currency=upper(new.currency) and transaction_id=new.provider_ref
  ) then raise exception 'WaafiPay confirmation is required.'; end if;
  return new;
end $$;
create trigger guard_waafi_payment_receipt before insert or update on public.payments
  for each row execute function public.guard_waafi_payment_receipt();

create function public.guard_waafi_topup_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provider='waafi' and new.rail='online' and new.status='approved' and not exists(
    select 1 from public.waafi_receipts where reference_id=new.id and amount=new.amount
      and currency='USD' and transaction_id=new.provider_ref
  ) then raise exception 'WaafiPay confirmation is required.'; end if;
  return new;
end $$;
create trigger guard_waafi_topup_receipt before insert or update on public.agency_topup_requests
  for each row execute function public.guard_waafi_topup_receipt();

-- Customers initiate pending records only; settlement is always server-authoritative.
alter policy "payments: creator initiates payment on own order" on public.payments
  with check (public.can_access_order(order_id) and status='processing' and provider_ref is null and paid_at is null);
