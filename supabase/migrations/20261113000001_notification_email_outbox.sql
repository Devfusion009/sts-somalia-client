-- Notification email outbox.
--
-- Every in-app notification (the portal bell) is also an email job: the web
-- app's background worker claims pending rows, sends one branded email per
-- row from no-reply@, and records the outcome here. Sending lives in the app
-- (SMTP credentials never reach the database); this migration only adds the
-- queue state, the claim function and one new event.
--
-- Rows that existed before this migration keep email_status = null and are
-- never emailed retroactively; only rows inserted from now on start pending.

alter table public.notifications
  add column email_status text
    check (email_status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  add column email_attempts smallint not null default 0,
  add column email_claimed_at timestamptz,
  add column emailed_at timestamptz;

alter table public.notifications alter column email_status set default 'pending';

create index notifications_email_queue_idx
  on public.notifications (created_at)
  where email_status in ('pending', 'sending');

-- Authenticated users keep their column grant on read_at only, so nobody can
-- mark their own row sent or re-queue it.

/**
 * Claims up to p_limit rows for sending. SKIP LOCKED lets two app instances
 * run the worker without sending the same email twice; a row stuck in
 * 'sending' (the worker died mid-send) is reclaimed after ten minutes. Only
 * the last three days are considered, so a long outage never floods inboxes
 * with stale alerts, and three attempts is the limit.
 */
create or replace function public.claim_notification_emails(p_limit integer default 25)
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  update public.notifications n
     set email_status = 'sending',
         email_claimed_at = now(),
         email_attempts = n.email_attempts + 1
   where n.id in (
     select q.id
       from public.notifications q
      where q.created_at > now() - interval '3 days'
        and q.email_attempts < 3
        and (
          q.email_status = 'pending'
          or (q.email_status = 'sending' and q.email_claimed_at < now() - interval '10 minutes')
        )
      order by q.created_at
      limit greatest(1, least(coalesce(p_limit, 25), 100))
      for update skip locked
   )
  returning n.*;
$$;

revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;

/**
 * "Payment received" for direct (B2C) orders, the receipt customers expect
 * the moment an order is fully paid. Agency orders are left out: a wallet
 * payment already raises wallet_booking_payment for the agent.
 */
create or replace function public.notify_customer_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid'
     and new.agency_id is null
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications (profile_id, type, title, body, data)
    values (
      new.customer_id,
      'order_paid',
      'Payment received',
      'Payment for ' || new.order_number || ' is complete. Your booking is confirmed.',
      jsonb_build_object(
        'order_id', new.id,
        'order_number', new.order_number,
        'total', new.total,
        'currency', new.currency
      )
    );
  end if;
  return new;
end;
$$;

create trigger orders_notify_customer_paid
  after insert or update of status on public.orders
  for each row execute function public.notify_customer_order_paid();
