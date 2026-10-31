-- Check constraints for values that can never be valid.
--
-- The forms and services already validate these, but a constraint holds for
-- every writer: an RPC, a script, the SQL editor, a future service. The
-- schema already does this for prices, quantities and date ranges; this adds
-- the columns that were left without one:
--   * money that cannot be negative (order totals, visa prices and fees);
--   * ISO codes: currency (3 capital letters), country (2), IATA airport (3),
--     IATA airline (2 letters or digits), ICAO;
--   * counts, sizes and day ranges that cannot be negative or inverted;
--   * card expiry month, map coordinates, payout periods.
-- Signed amounts (wallet transactions, agency credit balance) and free-text
-- country fields on profiles and partner records are left alone on purpose.
--
-- Each constraint is added NOT VALID, which checks new writes only, then
-- validated against the existing rows. If any existing row breaks it, the
-- constraint is dropped again and a WARNING names it with the row count, so
-- a bad row in production never becomes a row nobody can update. Fix the
-- data and run this migration again; constraints already in place are
-- skipped. A table or column that does not exist on this database is skipped
-- too.
--
-- Locking: adding the constraint takes a short exclusive lock and the
-- validation reads the whole table, inside one transaction. Apply it outside
-- peak hours.
do $$
declare
  c record;
  v_bad bigint;
begin
  for c in
    select * from (values
      -- Money
      ('orders', 'orders_subtotal_check', array['subtotal'], 'subtotal >= 0'),
      ('orders', 'orders_discount_total_check', array['discount_total'], 'discount_total >= 0'),
      ('orders', 'orders_tax_total_check', array['tax_total'], 'tax_total >= 0'),
      ('orders', 'orders_total_check', array['total'], 'total >= 0'),
      ('visa_applications', 'visa_applications_price_check', array['price'], 'price >= 0'),
      ('visa_applications', 'visa_applications_fee_amount_check', array['fee_amount'], 'fee_amount >= 0'),
      ('visa_applications', 'visa_applications_resolved_price_check', array['resolved_price'], 'resolved_price >= 0'),
      ('visa_applications', 'visa_applications_resolved_processing_fee_check', array['resolved_processing_fee'], 'resolved_processing_fee >= 0'),
      ('visa_types', 'visa_types_processing_fee_check', array['processing_fee'], 'processing_fee >= 0'),
      ('umrah_package_departures', 'umrah_package_departures_price_override_check', array['price_override'], 'price_override >= 0'),
      ('agency_commission_entries', 'agency_commission_entries_rate_applied_check', array['rate_applied'], 'rate_applied >= 0 and rate_applied <= 100'),

      -- Currency codes (ISO 4217)
      ('agency_commission_payouts', 'agency_commission_payouts_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('agency_payout_requests', 'agency_payout_requests_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('agency_refund_requests', 'agency_refund_requests_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('agency_topup_requests', 'agency_topup_requests_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('booking_requests', 'booking_requests_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('commission_payouts', 'commission_payouts_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('event_venues', 'event_venues_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('flight_bookings', 'flight_bookings_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('flight_offers', 'flight_offers_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('hall_bookings', 'hall_bookings_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('hotel_bookings', 'hotel_bookings_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('hotel_rooms', 'hotel_rooms_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('invoices', 'invoices_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('orders', 'orders_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('payments', 'payments_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('umrah_bookings', 'umrah_bookings_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('umrah_custom_requests', 'umrah_custom_requests_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('umrah_packages', 'umrah_packages_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('umrah_services', 'umrah_services_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('visa_applications', 'visa_applications_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),
      ('visa_types', 'visa_types_currency_check', array['currency'], 'currency ~ ''^[A-Z]{3}$'''),

      -- Country codes (ISO 3166-1 alpha-2)
      ('airports', 'airports_country_code_check', array['country_code'], 'country_code ~ ''^[A-Z]{2}$'''),
      ('hotels', 'hotels_country_code_check', array['country_code'], 'country_code ~ ''^[A-Z]{2}$'''),
      ('event_venues', 'event_venues_country_code_check', array['country_code'], 'country_code ~ ''^[A-Z]{2}$'''),
      ('visa_types', 'visa_types_destination_country_code_check', array['destination_country_code'], 'destination_country_code ~ ''^[A-Z]{2}$'''),
      ('visa_nationality_rules', 'visa_nationality_rules_nationality_code_check', array['nationality_code'], 'nationality_code ~ ''^[A-Z]{2}$'''),

      -- Airport and airline codes
      ('airports', 'airports_iata_code_check', array['iata_code'], 'iata_code ~ ''^[A-Z]{3}$'''),
      ('airports', 'airports_icao_code_check', array['icao_code'], 'icao_code ~ ''^[A-Z0-9]{4}$'''),
      ('airlines', 'airlines_iata_code_check', array['iata_code'], 'iata_code ~ ''^[A-Z0-9]{2}$'''),
      ('airlines', 'airlines_icao_code_check', array['icao_code'], 'icao_code ~ ''^[A-Z]{3}$'''),
      ('umrah_packages', 'umrah_packages_origin_iata_check', array['origin_iata'], 'origin_iata ~ ''^[A-Z]{3}$'''),
      ('umrah_packages', 'umrah_packages_destination_iata_check', array['destination_iata'], 'destination_iata ~ ''^[A-Z]{3}$'''),

      -- Counts, sizes and day ranges
      ('affiliate_links', 'affiliate_links_clicks_count_check', array['clicks_count'], 'clicks_count >= 0'),
      ('hotel_rooms', 'hotel_rooms_max_occupancy_check', array['max_occupancy'], 'max_occupancy >= 1'),
      ('hotel_rooms', 'hotel_rooms_size_sqm_check', array['size_sqm'], 'size_sqm >= 0'),
      ('event_venues', 'event_venues_size_sqm_check', array['size_sqm'], 'size_sqm >= 0'),
      ('umrah_packages', 'umrah_packages_duration_days_check', array['duration_days'], 'duration_days >= 1'),
      ('traveler_documents', 'traveler_documents_file_size_check', array['file_size'], 'file_size >= 0'),
      ('umrah_booking_documents', 'umrah_booking_documents_file_size_check', array['file_size'], 'file_size >= 0'),
      ('visa_documents', 'visa_documents_file_size_check', array['file_size'], 'file_size >= 0'),
      ('visa_types', 'visa_types_stay_days_check', array['stay_days'], 'stay_days >= 0'),
      ('visa_types', 'visa_types_validity_days_check', array['validity_days'], 'validity_days >= 0'),
      ('visa_types', 'visa_types_processing_days_check', array['processing_days_min', 'processing_days_max'],
        'processing_days_min >= 0 and processing_days_max >= processing_days_min'),
      ('visa_nationality_rules', 'visa_nationality_rules_processing_days_check', array['processing_days_min', 'processing_days_max'],
        'processing_days_min >= 0 and processing_days_max >= processing_days_min'),
      ('visa_applications', 'visa_applications_resolved_processing_days_check', array['resolved_processing_days_min', 'resolved_processing_days_max'],
        'resolved_processing_days_min >= 0 and resolved_processing_days_max >= resolved_processing_days_min'),

      -- Card expiry, coordinates, payout periods
      ('payment_methods', 'payment_methods_exp_month_check', array['exp_month'], 'exp_month between 1 and 12'),
      ('hotels', 'hotels_coordinates_check', array['latitude', 'longitude'], 'latitude between -90 and 90 and longitude between -180 and 180'),
      ('airports', 'airports_coordinates_check', array['latitude', 'longitude'], 'latitude between -90 and 90 and longitude between -180 and 180'),
      ('agency_commission_payouts', 'agency_commission_payouts_period_check', array['period_start', 'period_end'], 'period_end >= period_start'),
      ('commission_payouts', 'commission_payouts_period_check', array['period_start', 'period_end'], 'period_end >= period_start')
    ) as t(table_name, constraint_name, columns, expr)
  loop
    -- Skip what this database does not have, or already has.
    continue when to_regclass(format('public.%I', c.table_name)) is null;
    continue when (
      select count(*) from pg_catalog.pg_attribute
      where attrelid = to_regclass(format('public.%I', c.table_name))
        and attname = any (c.columns) and attnum > 0 and not attisdropped
    ) <> array_length(c.columns, 1);
    continue when exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = to_regclass(format('public.%I', c.table_name)) and conname = c.constraint_name
    );

    execute format('alter table public.%I add constraint %I check (%s) not valid',
      c.table_name, c.constraint_name, c.expr);
    begin
      execute format('alter table public.%I validate constraint %I', c.table_name, c.constraint_name);
    exception when check_violation then
      execute format('alter table public.%I drop constraint %I', c.table_name, c.constraint_name);
      -- A NULL makes a CHECK pass, so only rows where the rule is false count.
      execute format('select count(*) from public.%I where not (%s)', c.table_name, c.expr) into v_bad;
      raise warning '% not added: % existing row(s) in public.% break %',
        c.constraint_name, v_bad, c.table_name, c.expr;
    end;
  end loop;
end;
$$;
