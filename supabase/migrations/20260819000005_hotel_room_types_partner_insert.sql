-- ============================================================================
-- Hotel partners register their own real rooms too (src/app/partner/hotels/
-- [id]/room-form.tsx) — they should get the same "pick a shared room type or
-- add a new one" convenience as admin, and their real-world room names are a
-- legitimate source of new catalog entries, not just admin's. Insert-only:
-- partners can add a name to the shared list but not edit/delete existing
-- ones — that curation stays admin-only via the existing "admin manage"
-- policy.
-- ============================================================================

create policy "hotel_room_types: hotel partner members add"
  on public.hotel_room_types for insert to authenticated
  with check (
    exists (
      select 1 from public.hotel_partner_members m
      where m.profile_id = auth.uid() and m.status = 'active'
    )
  );
