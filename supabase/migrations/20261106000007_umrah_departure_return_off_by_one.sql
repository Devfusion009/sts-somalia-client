-- Group Umrah departures were entered with return_date = departure_date +
-- duration_days, one day past the package: a "14D / 13N" trip leaving 1 Dec
-- returns 14 Dec (Day 14), not 15 Dec. The booking page then showed an empty
-- extra day and the "hotel nights do not match the dates" warning.
--
-- Corrected only where the departure follows exactly that pattern AND the
-- package's hotel nights add up to duration_days - 1, so a departure that
-- was deliberately set longer is left alone.
update public.umrah_package_departures d
   set return_date = d.departure_date + (p.duration_days - 1)
  from public.umrah_packages p
 where p.id = d.package_id
   and d.return_date = d.departure_date + p.duration_days
   and (select coalesce(sum(h.nights), 0) from public.umrah_package_hotels h where h.package_id = p.id)
       = p.duration_days - 1;
