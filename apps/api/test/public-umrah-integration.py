"""Run against an isolated temporary PostgreSQL cluster; never connects to app databases.
Usage: python3 apps/api/test/public-umrah-integration.py
Requires local PostgreSQL 16+ binaries. No Docker, credentials or network listener.
"""
from pathlib import Path
import os, subprocess, tempfile, concurrent.futures
ROOT=Path(__file__).resolve().parents[3]
BINS=Path(os.environ.get('PG_TEST_BIN','/usr/lib/postgresql/16/bin'))
def run(args, **kwargs):
    return subprocess.run([str(x) for x in args],text=True,capture_output=True,check=True,**kwargs)
def function(source, name):
    text=(ROOT/'supabase/migrations'/source).read_text()
    start=text.lower().index('create or replace function public.'+name+'(')
    end=text.index('$$;',start)+3
    return text[start:end]
with tempfile.TemporaryDirectory(prefix='sts-public-umrah-') as folder:
    tmp=Path(folder);data=tmp/'data'
    run([BINS/'initdb','-D',data,'-A','trust','--no-locale'])
    started=False
    try:
        run([BINS/'pg_ctl','-D',data,'-l',tmp/'postgres.log','-o',f"-k {tmp} -p 55439 -c listen_addresses='' -c shared_buffers=16MB -c max_connections=10",'start']);started=True
        args=[BINS/'psql','-X','-q','-v','ON_ERROR_STOP=1','-h',tmp,'-p','55439','-d','postgres']
        run(args+['-f',ROOT/'apps/api/test/public-umrah-fixture.sql'])
        run(args+['-f',ROOT/'supabase/migrations/20260917000001_umrah_seat_integrity.sql'])
        sql=function('20261113000002_private_umrah_packages.sql','create_umrah_group_booking')
        # The terms function uses a differently formatted CREATE declaration.
        terms=(ROOT/'supabase/migrations/20261106000005_umrah_late_booking_full_payment.sql').read_text()
        sql+='\n'+terms[terms.index('CREATE OR REPLACE FUNCTION'):terms.index('$function$;')+11]
        sql+='\n'+function('20261019000007_umrah_payment_schedule.sql','apply_umrah_stage_transition_internal')
        sql+='\n'+function('20261019000007_umrah_payment_schedule.sql','order_items_apply_umrah_terms')
        sql+='\n'+function('20260819000002_visa_partner_payments.sql','handle_payment_succeeded')
        run(args,input=sql)
        run(args+['-f',ROOT/'supabase/migrations/20261116000001_public_umrah_packages.sql'])
        run(args,input='create trigger order_items_apply_umrah_terms after insert on order_items for each row execute function order_items_apply_umrah_terms(); create trigger payments_settle_order before insert or update of status on payments for each row execute function handle_payment_succeeded();')
        run(args,input='create trigger orders_confirm_umrah_group_bookings after update of status on orders for each row execute function umrah_confirm_group_bookings_on_payment();')
        run(args+['-f',ROOT/'apps/api/test/public-umrah-checks.sql'])
        run(args,input='grant select on test_ids to authenticated;')
        query="""begin; set local role authenticated; select set_config('test.uid','00000000-0000-0000-0000-000000000002',true); select create_umrah_group_booking((select id from test_ids where name='departure'),1,0::smallint,'','[{"full_name":"Last Seat Traveller","gender":"male"}]',null); select pg_sleep(0.2); commit;"""
        def compete(_): return subprocess.run([str(x) for x in args],input=query,text=True,capture_output=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(compete,range(2)))
        assert sorted(r.returncode for r in results)==[0,3],[(r.returncode,r.stderr) for r in results]
        assert any('not enough seats left' in r.stderr for r in results)
        remaining=run(args+['-tAc',"select total_seats-booked_seats-offline_seats from umrah_package_departures where id=(select id from test_ids where name='departure')"]).stdout.strip()
        assert remaining=='0',remaining
        run(args+['-f',ROOT/'supabase/migrations/20261116000002_unified_umrah_pool.sql'])
        run(args+['-f',ROOT/'apps/api/test/unified-umrah-pool.sql'])
        print('PASS: package validation, publication, customer and agent inventory, payment gate, expiry, bank review, confirmation, pool totals, concurrent last-seat race.')
    except subprocess.CalledProcessError as error:
        print(error.stdout);print(error.stderr);
        if (tmp/'postgres.log').exists(): print((tmp/'postgres.log').read_text()[-4000:])
        raise
    finally:
        if started: run([BINS/'pg_ctl','-D',data,'-m','fast','stop'])
