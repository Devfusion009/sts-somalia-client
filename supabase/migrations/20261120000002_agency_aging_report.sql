create function public.admin_agency_aging_report()
returns table(agency_id uuid, agency_name text, contact_email text, outstanding_amount numeric, aging_since timestamptz)
language sql stable security definer set search_path=public as $$
  select a.id, a.name, a.contact_email::text, -a.credit_balance,
    coalesce(last_clean.created_at, a.created_at)
  from public.agencies a
  left join lateral (
    select t.created_at from public.agency_wallet_transactions t
    where t.agency_id=a.id and t.balance_after>=0
    order by t.created_at desc limit 1
  ) last_clean on true
  where public.is_admin() and a.credit_balance<0
  order by coalesce(last_clean.created_at,a.created_at), a.id;
$$;
revoke all on function public.admin_agency_aging_report() from public,anon;
grant execute on function public.admin_agency_aging_report() to authenticated;
