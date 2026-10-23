-- Private buckets: gate photos (yard visits) and pro documents (insurance, bond,
-- background check). Files are served only through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gate-photos', 'gate-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('pro-documents', 'pro-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy owner_read_private_files on storage.objects
  for select to authenticated
  using (bucket_id in ('gate-photos', 'pro-documents') and public.is_admin());
