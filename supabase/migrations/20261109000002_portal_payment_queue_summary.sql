-- Keep live balances in Postgres while returning one small dashboard result.
create or replace function public.agency_payment_queue_summary(p_agency_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not (public.is_agency_member(p_agency_id) or public.is_admin())
     or not exists (select 1 from public.agencies where id = p_agency_id and status <> 'suspended') then
    raise exception 'not authorised';
  end if;
  with balances as (
    select o.currency, greatest(o.total - coalesce(p.paid, 0), 0) as due
    from public.orders o
    left join lateral (
      select sum(amount) as paid from public.payments
      where order_id = o.id and status = 'succeeded'
    ) p on true
    where o.agency_id = p_agency_id
      and o.status in ('pending_payment', 'held', 'partially_paid') and o.total > 0
  ), currencies as (
    select currency, round(sum(due), 2) as amount from balances
    group by currency having sum(due) > 0
  )
  select jsonb_build_object(
    'count', (select count(*) from balances),
    'amounts', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) order by currency) from currencies), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.agency_payment_queue_summary(uuid) from public, anon;
grant execute on function public.agency_payment_queue_summary(uuid) to authenticated;
