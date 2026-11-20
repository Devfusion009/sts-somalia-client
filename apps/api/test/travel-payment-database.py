"""Isolated PostgreSQL integration checks; no provider network calls or real data.
Usage: python3 test/travel-payment-database.py /tmp/sts-travel-flow-XXXXXX 55439
Retains the newly created test database for inspection. Never accepts a remote host.
"""
import concurrent.futures
import json
import re
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[3]
socket = sys.argv[1]
port = sys.argv[2]
assert re.fullmatch(r'/tmp/sts-travel-flow-[A-Za-z0-9]+', socket)
assert port.isdigit() and 1024 < int(port) < 65536
name = 'sts_travel_test_' + str(int(time.time()))
base = ['psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-h', socket, '-p', port, '-U', 'sts_test']

def sql(source, database=name):
    result = subprocess.run(base + ['-d', database], input=source, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def migration(filename):
    return (root / 'supabase/migrations' / filename).read_text()

def function(source, name):
    start = source.index('create or replace function public.' + name + '(')
    return source[start:source.index('$$;', start) + 3]

sql('create database ' + name, 'postgres')
bootstrap = (root / 'apps/api/test/sql/waafi-bootstrap.sql').read_text()
wallet = migration('20260902000002_agency_wallet_topups.sql')
for fn in ['request_agency_topup', 'settle_agency_topup', 'fail_agency_topup']:
    bootstrap += '\n' + function(wallet, fn)
sql(bootstrap)
sql(migration('20261109000001_waafi_payment_reliability.sql'))
sql((root / 'apps/api/test/sql/waafi-reliability.sql').read_text())
print('PASS: existing Waafi SQL permissions, settlement, replay, mismatch, wallet and refund assertions')
sql('''
create type order_status as enum ('pending_payment','held','partially_paid','paid','cancelled','refunded');
alter table orders add column paid_at timestamptz;
alter table payments add column created_at timestamptz default now();
create table flight_bookings(id uuid primary key, status text default 'pending', raw_payload jsonb default '{}', updated_at timestamptz default now());
create table flight_passengers(id uuid primary key, booking_id uuid);
create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id),flight_booking_id uuid references flight_bookings(id));
create table platform_api_integrations(id uuid primary key default gen_random_uuid(),provider_key text unique,category text,is_active boolean default false,credentials_encrypted text,last_test_ok boolean);
''')
sql(function(migration('20260819000002_visa_partner_payments.sql'), 'handle_payment_succeeded'))
sql('create trigger payments_settle_order before insert or update of status on payments for each row execute function handle_payment_succeeded();')
for filename in ['20261113000003_instant_flight_booking.sql','20261120000005_flight_supplier_safety.sql','20261120000006_integration_activation.sql']:
    sql(migration(filename))
print('PASS: flight lifecycle, supplier safety and activation migrations execute on PostgreSQL')
claims = "set request.jwt.claim.role='service_role'; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';"
sql("insert into profiles values('00000000-0000-4000-8000-000000000001',false),('00000000-0000-4000-8000-000000000002',true);")

def uid(n):
    return f'00000000-0000-4000-8000-{n:012d}'

def booking(n, expired=False):
    # Test fixtures only; state transitions below use actual migration functions.
    sql(f"insert into orders(id,total) values('{uid(n)}',100); insert into flight_bookings(id,ticketing_status,priced_at,raw_payload) values('{uid(n)}','awaiting_payment',now(),jsonb_build_object('offer_expires_at',now()+interval '{'-1' if expired else '15'} minutes')); insert into order_items(order_id,flight_booking_id) values('{uid(n)}','{uid(n)}');")

def payment(n):
    sql(claims + f"insert into payments(id,order_id,provider,status,amount,currency) values('{uid(n+1000)}','{uid(n)}','waafi','processing',100,'USD'); select begin_waafi_attempt('{uid(n+1000)}','{uid(n)}',null,'sandbox','test-merchant');")

def settle(n):
    return claims + f"select settle_waafi_transaction('{uid(n+1000)}','sandbox','test-merchant','tx-{n}',100,'USD','event-{n}');"

def check(expression):
    assert sql(f'select ({expression})::text') == 'true', expression

def rejects(statement, message):
    try:
        sql(claims + statement)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError('Expected rejection: ' + message)

booking(100); payment(100)
check(f"(select ticketing_status='awaiting_payment' from flight_bookings where id='{uid(100)}')")
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    list(executor.map(sql, [settle(100), settle(100)]))
check(f"(select status='paid' from orders where id='{uid(100)}')")
check(f"(select ticketing_status='queued' from flight_bookings where id='{uid(100)}')")
check(f"(select count(*)=1 from waafi_receipts where reference_id='{uid(1100)}')")
print('PASS: concurrent payment callbacks settle once and automatically queue the flight')
claim = claims + 'select id from claim_flight_ticketing(1);'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    claimed = list(executor.map(sql, [claim, claim]))
assert sum(uid(100) in result for result in claimed) == 1
check(f"(select ticketing_attempts=1 from flight_bookings where id='{uid(100)}')")
print('PASS: two concurrent workers claim the paid flight only once')
sql(f"update flight_bookings set ticketing_claimed_at=now()-interval '11 minutes' where id='{uid(100)}';")
assert not sql(claim)
check(f"(select ticketing_status='failed' and ticketing_attempts=1 from flight_bookings where id='{uid(100)}')")
print('PASS: crashed supplier submission becomes review-only, never a second automatic booking')

booking(101, True)
rejects(f"insert into payments(id,order_id,provider,status,amount,currency) values('{uid(1101)}','{uid(101)}','waafi','processing',100,'USD');", 'offer_expired')
sql(claims + 'select expire_flight_fares();')
check(f"(select status='cancelled' from orders where id='{uid(101)}')")
print('PASS: supplier-expired fare rejects payment and closes the unpaid order')
booking(102)
rejects(f"insert into payments(id,order_id,provider,status,amount,currency) values('{uid(1102)}','{uid(102)}','waafi','processing',50,'USD');", 'flight_full_payment_required')
print('PASS: flight deposits cannot enter the payment pipeline')

booking(103); payment(103)
sql(f"update flight_bookings set raw_payload=jsonb_build_object('offer_expires_at',now()-interval '1 minute') where id='{uid(103)}';")
sql(claims + 'select expire_flight_fares();')
check(f"(select ticketing_status='awaiting_payment' from flight_bookings where id='{uid(103)}')")
sql(settle(103))
check(f"(select status='paid' from orders where id='{uid(103)}')")
check(f"(select count(*)=1 from waafi_receipts where reference_id='{uid(1103)}')")
print('PASS: in-flight payment survives fare cleanup; late funds are recorded for supplier expiry handling')
# Isolate the next worker scenario from the previous queued row.
sql(f"update flight_bookings set ticketing_status='failed',ticketing_error='Expired supplier offer; refund review' where id='{uid(103)}';")
booking(104); payment(104)
sql(f"update orders set status='cancelled' where id='{uid(104)}';")
sql(settle(104))
check(f"(select status='cancelled' from orders where id='{uid(104)}')")
check(f"(select status='requires_action' from payments where id='{uid(1104)}')")
check(f"(select ticketing_status='awaiting_payment' from flight_bookings where id='{uid(104)}')")
print('PASS: payment after cancellation records money without reopening or queueing the booking')

booking(105); payment(105)
sql(claims + f"select fail_waafi_attempt('{uid(1105)}');")
check(f"(select status='failed' from payments where id='{uid(1105)}')")
check(f"(select ticketing_status='awaiting_payment' from flight_bookings where id='{uid(105)}')")
print('PASS: failed payment does not submit a supplier booking')
sql(claims + "select record_waafi_review_event('sandbox','test-merchant','refund-test','refund','ref','tx-100'); select record_waafi_review_event('sandbox','test-merchant','refund-test','refund','ref','tx-100');")
check("(select count(*)=1 from waafi_webhook_events where event_id='refund-test')")
check(f"(select status='paid' from orders where id='{uid(100)}')")
print('PASS: refund callback is deduplicated and creates review, not a fabricated supplier cancellation')

# Delayed tickets are retrieved against a known supplier order, not booked again.
sql(f"update flight_bookings set ticketing_status='booked',provider_order_id='ord_fixture',booked_at=now(),ticketing_claimed_at=now()-interval '6 minutes' where id='{uid(100)}';")
check(f"exists(select 1 from claim_flight_ticket_checks(10) where id='{uid(100)}')")
assert not sql(claim)
sql(f"update flight_bookings set ticketing_status='ticketed',ticket_numbers=array['test-ticket-001'],ticketed_at=now() where id='{uid(100)}';")
check(f"not exists(select 1 from claim_flight_ticket_checks(10) where id='{uid(100)}')")
print('PASS: known supplier orders use ticket checks and ticketed rows leave the polling queue')

sql("insert into platform_api_integrations(provider_key,category,is_active,credentials_encrypted,last_test_ok) values('old','flights',true,'test-old',true),('duffel','flights',false,'test-new',true);")
rejects("select activate_platform_integration('duffel','test-new');", 'admin_required')
admin = "set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';"
try:
    sql(admin + "select activate_platform_integration('duffel','stale');")
except RuntimeError as error:
    assert 'tested_credentials_required' in str(error)
else:
    raise AssertionError('stale revision activated')
check("(select is_active from platform_api_integrations where provider_key='old')")
sql(admin + "select activate_platform_integration('duffel','test-new');")
check("(select count(*)=1 from platform_api_integrations where category='flights' and is_active)")
check("(select is_active from platform_api_integrations where provider_key='duffel')")
check("not has_function_privilege('anon','activate_platform_integration(text,text)','execute')")
print('PASS: activation enforces admin, credential revision, permissions and exclusive supplier selection')
print(json.dumps({'database': name, 'socket': socket, 'result': 'PASS', 'scope': 'real PostgreSQL migrations and transactions; provider responses and UI are not exercised'}))

subprocess.run(['node', str(root / 'apps/api/test/travel-provider-flow.cjs'), socket, port, name], check=True)
