-- Agency commission on a refunded or cancelled order is reversed.
--
-- record_agency_commission() writes an entry when an order is paid, but
-- nothing undid it when the order was later refunded: a fully refunded
-- booking kept its commission in the agent's "In review" earnings and an
-- admin could approve it by mistake.
--
-- Commission is approved only after the service date (20261108000003), so a
-- refund normally finds the entry still 'pending'. 'confirmed' entries are
-- reversed too. 'paid_out' entries have already left STS and stay as they are.

create or replace function public.reverse_agency_commission_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('refunded', 'cancelled')
     and old.status is distinct from new.status then
    update public.agency_commission_entries
       set status = 'reversed'
     where order_id = new.id
       and status in ('pending', 'confirmed');
  end if;
  return new;
end;
$$;

revoke execute on function public.reverse_agency_commission_on_refund() from public, anon, authenticated;

drop trigger if exists orders_reverse_agency_commission on public.orders;
create trigger orders_reverse_agency_commission
  after update of status on public.orders
  for each row execute function public.reverse_agency_commission_on_refund();

-- Backfill: orders already refunded or cancelled with commission not yet paid out.
update public.agency_commission_entries e
   set status = 'reversed'
  from public.orders o
 where o.id = e.order_id
   and o.status in ('refunded', 'cancelled')
   and e.status in ('pending', 'confirmed');
