-- A visa type was saved with Vietnam's phone dial code (84) in place of its
-- ISO country code, so the catalog and public site showed "84".
update public.visa_types
set destination_country_code = 'VN'
where destination_country_code = '84';
