-- 14/15 Storage: buckets, limits and object policies.
--   posters       public read. Staff write. Posters are resized client-side to <= 1600 px WebP before upload.
--   avatars       private. A person writes only the object named after their profile id (`<profile id>` or `<profile id>/...`);
--                 owner and staff read. The app serves other people's photos through short signed URLs after checking profile visibility.
--   private-docs  private. Staff only for now (member-visible documents arrive with the documents table).
-- SVG is deliberately absent from every allow-list (script-capable).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('posters', 'posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('private-docs', 'private-docs', false, 10485760, array['application/pdf', 'text/plain', 'text/markdown', 'text/csv'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- A signed-in token must come from the configured Clerk issuer for every bucket.
create policy issuer_pin on storage.objects as restrictive for all to authenticated
  using ((select app.jwt_issuer_ok())) with check ((select app.jwt_issuer_ok()));

-- Upsert needs INSERT + SELECT + UPDATE, so each writer gets all of them.
create policy posters_staff_select on storage.objects for select to authenticated using (bucket_id = 'posters' and (select app.is_staff()));
create policy posters_staff_insert on storage.objects for insert to authenticated with check (bucket_id = 'posters' and (select app.is_staff()));
create policy posters_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'posters' and (select app.is_staff())) with check (bucket_id = 'posters' and (select app.is_staff()));
create policy posters_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'posters' and (select app.is_staff()));

create policy avatars_owner_select on storage.objects for select to authenticated using (bucket_id = 'avatars' and (
  name = (select app.current_profile_id())::text or name like (select app.current_profile_id())::text || '/%' or (select app.is_staff())));
create policy avatars_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (
  name = (select app.current_profile_id())::text or name like (select app.current_profile_id())::text || '/%'));
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (name = (select app.current_profile_id())::text or name like (select app.current_profile_id())::text || '/%'))
  with check (bucket_id = 'avatars' and (name = (select app.current_profile_id())::text or name like (select app.current_profile_id())::text || '/%'));
create policy avatars_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (
  name = (select app.current_profile_id())::text or name like (select app.current_profile_id())::text || '/%' or (select app.is_staff())));

create policy private_docs_staff_select on storage.objects for select to authenticated using (bucket_id = 'private-docs' and (select app.is_staff()));
create policy private_docs_staff_insert on storage.objects for insert to authenticated with check (bucket_id = 'private-docs' and (select app.is_staff()));
create policy private_docs_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'private-docs' and (select app.is_staff())) with check (bucket_id = 'private-docs' and (select app.is_staff()));
create policy private_docs_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'private-docs' and (select app.is_staff()));
