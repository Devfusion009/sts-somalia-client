-- The demo hotel manager's hotel_managers row was inserted by 20260903000008
-- with no permissions set, defaulting to '{}' — MANAGER_PERMISSIONS
-- (modules/hotels/manager-permissions.ts) gates each nav item
-- (Bookings/Rooms & rates/Availability/Photos & logo/Hotel profile) on this
-- array being non-empty for that key, so an empty array hides everything
-- past Dashboard and Reviews. A demo account exists to show the portal off,
-- so it gets every permission that exists, not the minimum a real hotel
-- would hand a junior staffer.
update public.hotel_managers
set permissions = array['bookings', 'rooms', 'availability', 'photos', 'profile']
where profile_id = (select id from auth.users where email = 'demo.manager@stssomalia.com');
