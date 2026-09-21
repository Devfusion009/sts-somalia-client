-- ============================================================================
-- Somali-language hotel content. STS staff type this in themselves via the
-- admin hotel/room forms — these columns ship empty. English stays the
-- fallback everywhere Somali is null; no separate locale routing or i18n
-- library, this is content data on the existing rows, not app translation.
-- ============================================================================

alter table public.hotels
  add column description_so text;

alter table public.hotel_rooms
  add column name_so text,
  add column description_so text;
