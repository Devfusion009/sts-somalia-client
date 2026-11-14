-- Bank transfer evidence is private, versioned, and never itself settles an order.
create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','application/pdf')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  transfer_reference text,
  status text not null default 'submitted' check (status in ('submitted','rejected','accepted')),
  rejection_reason text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);
create index payment_proofs_latest on public.payment_proofs(payment_id,created_at desc,id desc);
alter table public.payment_proofs enable row level security;
grant select on public.payment_proofs to authenticated;
grant all on public.payment_proofs to service_role;
create policy "Payment evidence readers" on public.payment_proofs for select to authenticated
using (exists(select 1 from public.payments p where p.id=payment_id and public.can_access_order(p.order_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do nothing;
create policy "Upload pending bank evidence" on storage.objects for insert to authenticated
with check(bucket_id='payment-proofs' and exists(select 1 from public.payments p join public.orders o on o.id=p.order_id
where p.id::text=(storage.foldername(name))[1] and public.can_access_order(p.order_id)
and p.provider='manual' and p.method_label='Bank Transfer' and p.status='requires_action'
and o.status in ('pending_payment','held','partially_paid')));
create policy "Read linked payment evidence" on storage.objects for select to authenticated
using(bucket_id='payment-proofs' and exists(select 1 from public.payment_proofs r join public.payments p on p.id=r.payment_id
where r.storage_path=name and public.can_access_order(p.order_id)));
create policy "Remove unlinked payment upload" on storage.objects for delete to authenticated
using(bucket_id='payment-proofs' and owner_id=auth.uid()::text and not exists(select 1 from public.payment_proofs where storage_path=name));

create function public.submit_payment_proof(p_payment_id uuid,p_path text,p_name text,p_type text,p_size bigint,p_reference text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.payments; v_id uuid;
begin
  select * into p from public.payments where id=p_payment_id for update;
  if not found or not public.can_access_order(p.order_id) then raise exception 'Payment not found.'; end if;
  if p.provider<>'manual' or p.method_label<>'Bank Transfer' or p.status<>'requires_action' then raise exception 'This payment is not awaiting bank transfer proof.'; end if;
  if not exists(select 1 from public.orders where id=p.order_id and status in ('pending_payment','held','partially_paid')) then raise exception 'This order is no longer awaiting payment.'; end if;
  if split_part(p_path,'/',1)<>p.id::text or not exists(select 1 from storage.objects where bucket_id='payment-proofs' and name=p_path and owner_id=auth.uid()::text) then raise exception 'Upload the proof first.'; end if;
  if (select status from public.payment_proofs where payment_id=p.id order by created_at desc,id desc limit 1)='submitted' then raise exception 'A transfer proof is already awaiting review.'; end if;
  insert into public.payment_proofs(payment_id,storage_path,file_name,content_type,file_size,transfer_reference,uploaded_by)
  values(p.id,p_path,p_name,p_type,p_size,nullif(btrim(p_reference),''),auth.uid()) returning id into v_id;
  insert into public.notifications(profile_id,type,title,body,data)
  select id,'bank_proof_submitted','Bank transfer proof ready','A transfer receipt is ready for review.',
    jsonb_build_object('order_id',p.order_id,'payment_id',p.id)
  from public.profiles where is_platform_admin;
  return v_id;
end; $$;
revoke all on function public.submit_payment_proof(uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.submit_payment_proof(uuid,text,text,text,bigint,text) to authenticated;

create function public.reject_payment_proof(p_proof_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.payment_proofs; p public.payments;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Enter what the customer needs to correct.'; end if;
  select * into r from public.payment_proofs where id=p_proof_id;
  if not found then raise exception 'Proof not found.'; end if;
  select * into p from public.payments where id=r.payment_id for update;
  -- Re-read after taking the payment lock: another reviewer may have acted.
  select * into r from public.payment_proofs where id=p_proof_id;
  if p.status<>'requires_action' or r.status<>'submitted' or r.id<>(select id from public.payment_proofs where payment_id=p.id order by created_at desc,id desc limit 1) then raise exception 'Refresh to review the latest pending proof.'; end if;
  update public.payment_proofs set status='rejected',rejection_reason=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
  insert into public.notifications(profile_id,type,title,body,data)
  select customer_id,'bank_proof_rejected','Transfer proof needs correction',btrim(p_reason),
    jsonb_build_object('order_id',p.order_id,'payment_id',p.id)
  from public.orders where id=p.order_id;
end; $$;
revoke all on function public.reject_payment_proof(uuid,text) from public,anon;
grant execute on function public.reject_payment_proof(uuid,text) to authenticated;

drop function public.confirm_manual_payment(uuid);
create or replace function public.confirm_manual_payment(p_payment_id uuid, p_proof_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_order_id uuid;
  v_paid numeric;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select order_id into v_order_id from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found.'; end if;
  select * into v_order from public.orders where id = v_order_id for update;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.provider <> 'manual' then
    raise exception 'Online payments require confirmation from the payment provider.';
  end if;
  -- A repeat click must not settle or notify twice.
  if v_payment.status = 'succeeded' then return; end if;
  if v_payment.status <> 'requires_action' then
    raise exception 'Only pending manual payments can be approved.';
  end if;
  if v_order.status not in ('pending_payment', 'held', 'partially_paid') then
    raise exception 'This order is no longer awaiting payment.';
  end if;
  if v_order.status = 'held' and v_order.hold_expires_at is not null and v_order.hold_expires_at <= now() then
    raise exception 'This order has expired.';
  end if;
  if exists (select 1 from public.payments where order_id = v_order.id
    and provider <> 'manual' and status in ('processing', 'requires_action')) then
    raise exception 'An online payment is still awaiting confirmation.';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
    where order_id = v_order.id and status = 'succeeded';
  if v_payment.currency <> v_order.currency or v_payment.amount <= 0
     or v_payment.amount > v_order.total - v_paid then
    raise exception 'The payment does not match the remaining balance.';
  end if;

  if v_payment.method_label = 'Bank Transfer' then
    if p_proof_id is null or not exists (
      select 1 from public.payment_proofs p where p.id = p_proof_id and p.payment_id = v_payment.id
        and p.status = 'submitted' and p.id = (select id from public.payment_proofs where payment_id=v_payment.id order by created_at desc, id desc limit 1)
    ) then raise exception 'Review the latest bank transfer proof before approving payment.'; end if;
    update public.payment_proofs set status='accepted', reviewed_by=auth.uid(), reviewed_at=now() where id=p_proof_id;
  end if;
  update public.payments set status = 'succeeded' where id = p_payment_id;
end;
$$;

revoke all on function public.confirm_manual_payment(uuid,uuid) from public,anon;
grant execute on function public.confirm_manual_payment(uuid,uuid) to authenticated;

-- Serialize manual checkout requests per order; double-clicks cannot create duplicates.
create function public.guard_manual_payment_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.provider='manual' and new.status in ('processing','requires_action') then
    perform 1 from public.orders where id=new.order_id for update;
    if exists(select 1 from public.payments where order_id=new.order_id and status in ('processing','requires_action')) then
      raise exception 'A payment request is already pending. Refresh checkout to continue.';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.guard_manual_payment_request() from public,anon,authenticated;
create trigger guard_manual_payment_request before insert on public.payments
for each row execute function public.guard_manual_payment_request();
