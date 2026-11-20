"""Exercise selected Umrah capacity in an isolated PostgreSQL cluster."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
BINS = Path(os.environ.get("PG_TEST_BIN", "/usr/lib/postgresql/16/bin"))

def run(args, **kwargs):
    return subprocess.run([str(arg) for arg in args], text=True, capture_output=True, check=True, **kwargs)

with tempfile.TemporaryDirectory(prefix="sts-umrah-capacity-") as folder:
    tmp = Path(folder)
    data = tmp / "data"
    run([BINS / "initdb", "-D", data, "-A", "trust", "--no-locale"])
    started = False
    try:
        run([BINS / "pg_ctl", "-D", data, "-l", tmp / "postgres.log", "-o", f"-k {tmp} -p 55441 -c listen_addresses='' -c shared_buffers=16MB", "start"])
        started = True
        psql = [BINS / "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", tmp, "-p", "55441", "-d", "postgres"]
        run(psql, input="""
          create role anon; create role authenticated;
          create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
          create table umrah_package_departures(id uuid primary key,package_id uuid,total_seats integer,offline_seats integer,booked_seats integer,booking_mode text,formation_status text);
          create table umrah_pool_requests(departure_id uuid,num_pilgrims integer,status text);
          create table umrah_bookings(departure_id uuid,num_pilgrims integer,status text);
        """)
        run(psql + ["-f", ROOT / "supabase/migrations/20261120000003_admin_umrah_capacity_selection.sql"])
        run(psql, input="""
          insert into umrah_package_departures values
          ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',40,2,8,'request_then_pay','forming'),
          ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000012',20,1,5,'pay_now','ready');
          insert into umrah_pool_requests values('00000000-0000-0000-0000-000000000001',3,'paid'),('00000000-0000-0000-0000-000000000001',5,'payment_due');
          insert into umrah_bookings values('00000000-0000-0000-0000-000000000002',2,'confirmed'),('00000000-0000-0000-0000-000000000002',3,'pending');
          select set_config('test.admin','yes',false);
          do $$ declare r record; begin
            select * into r from admin_umrah_capacity_for_departures(array['00000000-0000-0000-0000-000000000001'::uuid]);
            if r.confirmed_seats<>3 or r.held_seats<>5 or r.offline_seats<>2 then raise exception 'request pool capacity wrong'; end if;
            if (select count(*) from admin_umrah_capacity_for_departures(array['00000000-0000-0000-0000-000000000001'::uuid]))<>1 then raise exception 'selected capacity returned extra rows'; end if;
            select * into r from admin_umrah_capacity_for_departures(array['00000000-0000-0000-0000-000000000002'::uuid]);
            if r.confirmed_seats<>2 or r.held_seats<>3 then raise exception 'direct pool capacity wrong'; end if;
          end $$;
          select set_config('test.admin','no',false);
          do $$ begin
            begin perform admin_umrah_capacity_for_departures(array['00000000-0000-0000-0000-000000000001'::uuid]); raise exception 'non-admin granted capacity';
            exception when raise_exception then if sqlerrm='non-admin granted capacity' then raise; end if; end;
          end $$;
        """)
        print("PASS: selected request/direct capacity and admin access.")
    except subprocess.CalledProcessError as error:
        print(error.stdout, error.stderr)
        if (tmp / "postgres.log").exists(): print((tmp / "postgres.log").read_text()[-1500:])
        raise
    finally:
        if started:
            run([BINS / "pg_ctl", "-D", data, "-m", "fast", "stop"])
