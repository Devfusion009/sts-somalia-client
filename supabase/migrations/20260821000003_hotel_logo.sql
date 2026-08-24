-- Hotel logo: a distinct concept from the property photo gallery (hotels.images
-- + hotel-images bucket) — a small brand mark for the property/chain, not a
-- photo of the building. Same shape as agencies.logo_path / agency-logos
-- (20260809000001): single column, dedicated public bucket, one file.
alter table public.hotels add column logo_path text;

insert into storage.buckets (id, name, public) values
  ('hotel-logos', 'hotel-logos', true)
on conflict (id) do nothing;

-- hotel-logos/{hotel_id}/filename — public read; owning partner or a manager
-- with can_manage_photos writes; admin manages all. Same ownership check as
-- hotel-images' partner policy, plus the manager grant hotel-images itself
-- is missing (see the fix below).
create policy "hotel_logos: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'hotel-logos');

create policy "hotel_logos: partner or permitted manager writes own hotel folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hotel-logos'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and (public.is_hotel_partner_member(h.partner_id) or public.hotel_manager_can_manage_photos(h.id))
    )
  );

create policy "hotel_logos: partner or permitted manager manages own hotel folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hotel-logos'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and (public.is_hotel_partner_member(h.partner_id) or public.hotel_manager_can_manage_photos(h.id))
    )
  );

create policy "hotel_logos: partner or permitted manager deletes own hotel folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'hotel-logos'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and (public.is_hotel_partner_member(h.partner_id) or public.hotel_manager_can_manage_photos(h.id))
    )
  );

create policy "hotel_logos: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'hotel-logos' and public.is_admin())
  with check (bucket_id = 'hotel-logos' and public.is_admin());

-- Fix a real gap this surfaced: a manager granted can_manage_photos
-- (20260821000002) can pass the app-level check and the hotels-table RLS,
-- but the hotel-images STORAGE BUCKET policies (20260101000010) only ever
-- checked is_hotel_partner_member — a permitted manager's actual file
-- upload would be rejected by storage RLS despite the UI offering it.
-- Widen the three write policies to match hotel-logos' shape above.
drop policy "hotel_images: partner writes own hotel folder" on storage.objects;
create policy "hotel_images: partner or permitted manager writes own hotel folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hotel-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and (public.is_hotel_partner_member(h.partner_id) or public.hotel_manager_can_manage_photos(h.id))
    )
  );

drop policy "hotel_images: partner manages own hotel folder" on storage.objects;
create policy "hotel_images: partner or permitted manager manages own hotel folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hotel-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and (public.is_hotel_partner_member(h.partner_id) or public.hotel_manager_can_manage_photos(h.id))
    )
  );

drop policy "hotel_images: partner deletes own hotel folder" on storage.objects;
create policy "hotel_images: partner or permitted manager deletes own hotel folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'hotel-images'
    and exists (
      select 1 from public.hotels h
      where h.id::text = (storage.foldername(name))[1]
        and (public.is_hotel_partner_member(h.partner_id) or public.hotel_manager_can_manage_photos(h.id))
    )
  );
