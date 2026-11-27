"""Test bounded unified booking references in an isolated PostgreSQL cluster."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
BINS = Path(os.environ.get("PG_TEST_BIN", "/usr/lib/postgresql/16/bin"))

def run(args, **kwargs):
    return subprocess.run([str(arg) for arg in args], text=True, capture_output=True, check=True, **kwargs)

with tempfile.TemporaryDirectory(prefix="sts-booking-page-") as folder:
    tmp = Path(folder)
    data = tmp / "data"
    run([BINS / "initdb", "-D", data, "-A", "trust", "--no-locale"])
    started = False
    try:
        run([BINS / "pg_ctl", "-D", data, "-l", tmp / "postgres.log", "-o", f"-k {tmp} -p 55442 -c listen_addresses='' -c shared_buffers=16MB", "start"])
        started = True
        psql = [BINS / "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", tmp, "-p", "55442", "-d", "postgres"]
        run(psql, input="""
          create role anon; create role authenticated;
          create schema auth;
          create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
          create table hotel_bookings(id uuid primary key,customer_id uuid,booked_by uuid,created_at timestamptz,status text,check_in date);
          create table flight_bookings(id uuid primary key,customer_id uuid,booked_by uuid,created_at timestamptz,status text,depart_at timestamptz);
          create table visa_applications(id uuid primary key,applicant_profile_id uuid,submitted_by uuid,created_at timestamptz,status text,travel_details jsonb);
          create table umrah_package_departures(id uuid primary key,departure_date date);
          create table umrah_custom_requests(id uuid primary key,departure_date date);
          create table umrah_bookings(id uuid primary key,customer_id uuid,booked_by uuid,created_at timestamptz,status text,departure_id uuid,custom_request_id uuid);
          create table hall_bookings(id uuid primary key,customer_id uuid,booked_by uuid,created_at timestamptz,status text,start_date date);
          create table order_items(order_id uuid,hotel_booking_id uuid,flight_booking_id uuid,visa_application_id uuid,umrah_booking_id uuid,hall_booking_id uuid);
          grant usage on schema public,auth to authenticated;
          grant select on all tables in schema public to authenticated;
          grant execute on function auth.uid() to authenticated;
          alter table flight_bookings enable row level security;
          create policy own_flights on flight_bookings for select to authenticated using (customer_id=auth.uid() or booked_by=auth.uid());
        """)
        run(psql + ["-f", ROOT / "supabase/migrations/20261120000004_my_bookings_page.sql"])
        run(psql, input="""
          insert into flight_bookings
          select md5('flight-'||i)::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,
                 timestamp with time zone '2026-11-19 00:00:00+00' - i*interval '1 second','confirmed','2027-02-01'::timestamptz
          from generate_series(1,1001) i;
          insert into flight_bookings values(md5('other-flight')::uuid,'00000000-0000-0000-0000-000000000002'::uuid,'00000000-0000-0000-0000-000000000002'::uuid,now(),'confirmed',now());
          update flight_bookings set depart_at='2026-12-01' where id=md5('flight-1001')::uuid;
          insert into order_items(order_id,flight_booking_id) values
            ('00000000-0000-0000-0000-000000000099',md5('flight-1')::uuid),
            ('00000000-0000-0000-0000-000000000099',md5('flight-2')::uuid);
          set role authenticated;
          select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
          do $$ declare a jsonb; b jsonb; begin
            a:=my_booking_page(1,20,'all',null,false);
            b:=my_booking_page(51,20,'all',null,false);
            if (a->>'total')::int<>1001 or jsonb_array_length(a->'refs')<>20 or jsonb_array_length(b->'refs')<>1 then raise exception 'pagination/count failed'; end if;
            if (a->'counts'->>'upcoming')::int<>1001 then raise exception 'timeframe count failed'; end if;
            if (a->'refs'->0->>'id')=(b->'refs'->0->>'id') then raise exception 'unstable page'; end if;
            a:=my_booking_page(1,1,'all',null,false,'trips');
            if (a->>'total')::int<>1000 or jsonb_array_length(a->'refs')<>2 then raise exception 'trip was split across pages'; end if;
            a:=my_booking_page(1,1,'upcoming',null,false,'list','travel');
            if a->'refs'->0->>'id'<>md5('flight-1001')::uuid::text then raise exception 'nearest trip was not first'; end if;
          end $$;
          select set_config('test.uid','00000000-0000-0000-0000-000000000002',false);
          do $$ begin if (my_booking_page(1,20,'all',null,false)->>'total')::int<>1 then raise exception 'account isolation failed'; end if; end $$;
          reset role;
          insert into flight_bookings values(md5('agent-booked')::uuid,'00000000-0000-0000-0000-000000000002'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,now(),'confirmed',now());
          set role authenticated;
          select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
          do $$ begin
            if (my_booking_page(1,20,'all',null,false)->>'total')::int<>1002 then raise exception 'agent booking missing'; end if;
            if (my_booking_page(1,20,'all',null,true)->>'total')::int<>1001 then raise exception 'personal-only leaked agency booking'; end if;
          end $$;
          reset role;
          insert into visa_applications values(md5('cancelled-visa')::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,now(),'cancelled','{}'::jsonb);
          set role authenticated;
          select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
          do $$ declare result jsonb; begin
            result:=my_booking_page(1,20,'cancelled','visa',true);
            if (result->>'total')::int<>1 or result->'counts'->>'cancelled'<>'1' or result->'refs'->0->>'type'<>'visa' then raise exception 'filter or type count failed'; end if;
          end $$;
        """)
        print("PASS: 1,001 booking pages, exact counts, stable ordering, and account isolation.")
    except subprocess.CalledProcessError as error:
        print(error.stdout, error.stderr)
        if (tmp / "postgres.log").exists(): print((tmp / "postgres.log").read_text()[-1500:])
        raise
    finally:
        if started:
            run([BINS / "pg_ctl", "-D", data, "-m", "fast", "stop"])
