-- Isolated test database only: minimal dependencies for the real wallet RPCs.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
grant usage on schema auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
create table profiles(id uuid primary key,is_platform_admin boolean default false);
create table agencies(id uuid primary key,owner_id uuid,credit_balance numeric default 0);
create table orders(id uuid primary key,total numeric default 100,status text default 'pending_payment',customer_id uuid default '00000000-0000-4000-8000-000000000001',currency text default 'USD');
create table payments(id uuid primary key,order_id uuid references orders(id),provider text,status text,amount numeric,currency text,provider_ref text,method_label text,instructions text,paid_at timestamptz);
create table agency_wallet_transactions(id uuid primary key default gen_random_uuid(),agency_id uuid,amount numeric);
create table agency_topup_requests(id uuid primary key default gen_random_uuid(),agency_id uuid,amount numeric,rail text,method text,reference text,proof_path text,note text,provider text,requested_by uuid,
  requested_at timestamptz default now(),status text default 'pending',provider_ref text,review_note text,reviewed_at timestamptz,wallet_transaction_id uuid);
create table notifications(id uuid primary key default gen_random_uuid(),profile_id uuid,type text,title text,body text,data jsonb);
create function is_admin() returns boolean language sql stable security definer as $$ select coalesce((select is_platform_admin from profiles where id=auth.uid()),false) $$;
create function is_agency_owner_or_admin(agency_id uuid) returns boolean language sql stable as $$ select exists(select 1 from agencies where id=agency_id and owner_id=auth.uid()) $$;
create function credit_agency_wallet_internal(p_agency_id uuid,p_amount numeric,p_type text,p_order_id uuid,p_note text,p_actor uuid)
returns uuid language plpgsql as $$ declare v_id uuid; begin
  update agencies set credit_balance=credit_balance+p_amount where id=p_agency_id;
  insert into agency_wallet_transactions(agency_id,amount) values(p_agency_id,p_amount) returning id into v_id;
  return v_id;
end $$;

create function can_access_order(order_id uuid) returns boolean language sql stable security definer as $$
  select exists(select 1 from orders where id=order_id and customer_id=auth.uid())
$$;
alter table payments enable row level security;
grant usage on schema public to authenticated;
grant insert,select on payments to authenticated;
create policy "payments: creator initiates payment on own order" on payments for insert to authenticated with check(can_access_order(order_id));
create policy "payments: read via parent order" on payments for select to authenticated using(can_access_order(order_id));
