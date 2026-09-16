-- Front Desk phase B: "Add Booking" lets a hotel manager create a walk-in
-- reservation directly, but hotel_bookings had no INSERT policy for
-- managers at all — only "customer creates own booking" (booked_by =
-- auth.uid() and customer_id = auth.uid() or a valid agency). A manager
-- creating a booking for a guest with no account of their own would fail
-- that check. Reuses hotel_manager_can_manage_bookings(), the exact same
-- function the existing UPDATE policy already trusts for this hotel.
create policy "hotel_bookings: manager creates when permitted"
  on public.hotel_bookings for insert to authenticated
  with check (public.hotel_manager_can_manage_bookings(hotel_id));
