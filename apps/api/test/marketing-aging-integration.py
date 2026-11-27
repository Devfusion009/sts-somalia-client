"""Verify callback storage and agency aging SQL in an isolated PostgreSQL cluster."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
BINS = Path(os.environ.get("PG_TEST_BIN", "/usr/lib/postgresql/16/bin"))

def run(args, **kwargs):
    return subprocess.run([str(arg) for arg in args], text=True, capture_output=True, check=True, **kwargs)

with tempfile.TemporaryDirectory(prefix="sts-marketing-aging-") as folder:
    tmp = Path(folder)
    data = tmp / "data"
    run([BINS / "initdb", "-D", data, "-A", "trust", "--no-locale"])
    started = False
    try:
        run([BINS / "pg_ctl", "-D", data, "-l", tmp / "postgres.log", "-o", f"-k {tmp} -p 55440 -c listen_addresses='' -c shared_buffers=16MB", "start"])
        started = True
        psql = [BINS / "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", tmp, "-p", "55440", "-d", "postgres"]
        run(psql, input="""
          create role anon; create role authenticated;
          create extension citext;
          create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
          create table public.agencies(id uuid primary key default gen_random_uuid(),name text,contact_email citext,credit_balance numeric,created_at timestamptz);
          create table public.agency_wallet_transactions(agency_id uuid, balance_after numeric,created_at timestamptz);
        """)
        for name in ("20261120000001_marketing_callback_requests.sql", "20261120000002_agency_aging_report.sql"):
            run(psql + ["-f", ROOT / "supabase/migrations" / name])
        run(psql, input="""
          insert into marketing_callback_requests(name,phone,service) values('Test Customer','+252611234567','umrah');
          do $$ begin
            begin insert into marketing_callback_requests(name,phone,service) values('Test Customer','+252611234567','umrah');
              raise exception 'duplicate callback was accepted';
            exception when unique_violation then null; end;
          end $$;
          set role authenticated;
          select set_config('test.admin','no',false);
          do $$ begin if (select count(*) from marketing_callback_requests)<>0 then raise exception 'callback exposed to non-admin'; end if; end $$;
          select set_config('test.admin','yes',false);
          update marketing_callback_requests set status='contacted' where phone='+252611234567';
          do $$ begin if (select count(*) from marketing_callback_requests where status='contacted')<>1 then raise exception 'admin could not update callback'; end if; end $$;
          reset role;
          insert into agencies(name,contact_email,credit_balance,created_at) values('Agency A','a@example.test',-100,now()-interval '40 days');
          insert into agency_wallet_transactions select id,0,now()-interval '10 days' from agencies;
          select set_config('test.admin','yes',false);
          do $$ begin if (select count(*) from admin_agency_aging_report())<>1 then raise exception 'aging count'; end if; end $$;
          select set_config('test.admin','no',false);
          do $$ begin if (select count(*) from admin_agency_aging_report())<>0 then raise exception 'aging access'; end if; end $$;
        """)
        print("PASS: callbacks persist once per day; aging report is batched and admin-scoped.")
    except subprocess.CalledProcessError as error:
        print(error.stdout, error.stderr)
        raise
    finally:
        if started:
            run([BINS / "pg_ctl", "-D", data, "-m", "fast", "stop"])
