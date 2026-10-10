-- Admin-managed cover photo for a visa type, shown on the public destination
-- cards. Stores the object path inside the public `visa-images` bucket;
-- null falls back to the committed per-country photo.
alter table public.visa_types add column cover_image text;

insert into storage.buckets (id, name, public)
values ('visa-images', 'visa-images', true)
on conflict (id) do nothing;

create policy "visa_images: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'visa-images');

create policy "visa_images: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'visa-images' and public.is_admin())
  with check (bucket_id = 'visa-images' and public.is_admin());
