-- Switch mutually exclusive suppliers in one transaction, against the tested
-- credential revision. A failed activation must leave the previous provider on.
create or replace function public.activate_platform_integration(p_provider_key text, p_credentials_encrypted text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_provider public.platform_api_integrations;
begin
  if public.is_admin() is not true then raise exception 'admin_required'; end if;
  perform pg_advisory_xact_lock(hashtext('sts-provider-activation'));
  select * into v_provider from public.platform_api_integrations
    where provider_key = p_provider_key for update;
  if not found or v_provider.credentials_encrypted is distinct from p_credentials_encrypted
    or v_provider.credentials_encrypted is null or v_provider.last_test_ok is distinct from true then
    raise exception 'tested_credentials_required';
  end if;
  if v_provider.category = 'flights' then
    update public.platform_api_integrations set is_active = false
      where category = 'flights' and provider_key <> p_provider_key and is_active;
  elsif p_provider_key in ('stripe', 'razorpay') then
    update public.platform_api_integrations set is_active = false
      where provider_key in ('stripe', 'razorpay') and provider_key <> p_provider_key and is_active;
  end if;
  update public.platform_api_integrations set is_active = true where id = v_provider.id;
end;
$$;
revoke all on function public.activate_platform_integration(text, text) from public, anon;
grant execute on function public.activate_platform_integration(text, text) to authenticated;
