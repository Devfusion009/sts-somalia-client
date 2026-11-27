-- Additional isolated fixture dependencies, never an application database.
create table profiles(id uuid primary key, email text, full_name text);
insert into profiles values ('00000000-0000-0000-0000-000000000002','customer@example.test','QA Customer'),('00000000-0000-0000-0000-000000000003','other@example.test','QA Other'),('00000000-0000-0000-0000-000000000004','agent@example.test','QA Agent');
create table agencies(id uuid primary key, allowed_products text[] default '{}', contact_email text);
insert into agencies(id) values ('00000000-0000-0000-0000-000000000099');
create table agency_customers(id uuid primary key,agency_id uuid,full_name text);
insert into agency_customers values ('00000000-0000-0000-0000-000000000088','00000000-0000-0000-0000-000000000099','QA Agency Customer');
create table agency_markups(agency_id uuid,item_type text,markup_type text,value numeric);
create table platform_settings(key text primary key,value jsonb);
alter table umrah_packages add column images jsonb default '[]';
alter table orders add column customer_id uuid,add column booked_by uuid,add column agency_id uuid,add column subtotal numeric,add column markup_amount numeric default 0,add column order_number text default 'QA-ORDER';
alter table order_items add column item_type text,add column unit_price numeric,add column quantity integer,add column total_price numeric;
alter table payments add column currency text default 'USD';
alter table payments add column raw_payload jsonb default '{}';

create function public.is_agency_booker(uuid) returns boolean language sql stable as $$ select $1=any(public.my_agency_ids()) and coalesce(current_setting('test.viewer',true),'')<>'yes' $$;
