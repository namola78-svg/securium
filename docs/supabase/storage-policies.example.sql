-- REVIEW EXAMPLE ONLY. NOT APPLIED BY THIS SPRINT.
-- Run only after explicit approval in a disposable Supabase project first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-thumbnails', 'public-thumbnails', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('private-audio', 'private-audio', false, 104857600,
   array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg']),
  ('private-lectures', 'private-lectures', false, 524288000,
   array['video/mp4', 'video/webm']),
  ('course-assets', 'course-assets', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']),
  ('admin-imports', 'admin-imports', false, 26214400,
   array['text/csv', 'application/csv', 'application/json',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Server-only architecture: only public thumbnails have an anonymous read
-- policy. Private bucket access is performed by the service role after
-- application authorization and through short-lived signed URLs.
drop policy if exists "public thumbnails read" on storage.objects;
create policy "public thumbnails read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'public-thumbnails');

-- Deliberately no anon/authenticated INSERT, UPDATE, DELETE policy.
-- Deliberately no anon/authenticated SELECT policy for private buckets.
