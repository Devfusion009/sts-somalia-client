select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
select set_config('test.admin','yes',false);
insert into test_ids values('private_pool',create_public_umrah_package(
 (select to_jsonb(p) || jsonb_build_object('slug','agency-event','name','Horn Travel Group','pool_visibility','private','organizer_name','Horn Travel','contact_person_email','coordinator@example.com') from umrah_packages p where id=(select id from test_ids where name='package')),current_date+120,20));
do $$ begin
 begin update umrah_packages set status='published' where id=(select id from test_ids where name='private_pool'); raise exception 'Expected assignment error'; exception when raise_exception then if sqlerrm<>'Assign an agency before publishing a private Umrah pool.' then raise; end if; end;
end $$;
insert into umrah_package_agencies values((select id from test_ids where name='private_pool'),'00000000-0000-0000-0000-000000000099');
update umrah_packages set status='published' where id=(select id from test_ids where name='private_pool');
insert into test_ids select 'private_departure',id from umrah_package_departures where package_id=(select id from test_ids where name='private_pool');
select set_config('test.admin','no',false);
select set_config('test.agent','no',false);
set role anon;
do $$ begin
 if exists(select 1 from umrah_packages where slug='agency-event') then raise exception 'Private pool leaked to public'; end if;
end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform create_umrah_group_booking((select id from test_ids where name='private_departure'),1,0::smallint,'','[{"full_name":"Unassigned Customer","gender":"male"}]',null); raise exception 'Expected private booking rejection'; exception when raise_exception then if sqlerrm<>'This Umrah pool is reserved for its assigned agency.' then raise; end if; end;
end $$;
select set_config('test.agent','yes',false);
do $$ begin
 if not exists(select 1 from umrah_packages where slug='agency-event') then raise exception 'Assigned agency cannot read its pool'; end if;
 perform create_umrah_group_booking((select id from test_ids where name='private_departure'),1,0::smallint,'','[{"full_name":"Agency Pilgrim","gender":"male"}]','00000000-0000-0000-0000-000000000099');
end $$;
reset role;
select set_config('test.admin','yes',false);
do $$ declare r jsonb; begin
 select value into r from jsonb_array_elements(admin_public_umrah_pool()) where value->>'name'='Horn Travel Group';
 if (r->>'total_seats')::int<>20 or (r->>'held_seats')::int<>1 or (r->>'available_seats')::int<>19 or r->>'organizer_name'<>'Horn Travel' then raise exception 'Unified pool totals incorrect: %',r; end if;
end $$;
