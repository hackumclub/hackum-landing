begin;
select plan(24);

-- every table: RLS on, plus the restrictive Clerk-issuer pin
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'RLS is enabled on every public table');
select ok((select relrowsecurity from pg_class where oid = 'app.settings'::regclass), 'RLS is enabled on app.settings');
select is((select count(*) from pg_tables t where t.schemaname = 'public' and not exists (
  select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename and p.policyname = 'issuer_pin' and p.permissive = 'RESTRICTIVE')),
  0::bigint, 'every public table has a restrictive issuer_pin policy');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'issuer_pin' and permissive = 'RESTRICTIVE'), 1::bigint, 'storage.objects has the issuer pin');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'), 22::bigint, '22 public tables (nothing added without an RLS review)');

-- privileges are closed by default
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot select profiles');
select ok(not has_table_privilege('anon', 'public.event_registrations', 'select'), 'anon cannot select registrations');
select ok(not has_table_privilege('authenticated', 'public.event_registrations', 'insert'), 'authenticated cannot insert registrations directly');
select ok(not has_table_privilege('authenticated', 'public.membership_applications', 'update'), 'no direct update on applications');
select ok(not has_table_privilege('authenticated', 'public.poll_votes', 'insert'), 'no direct insert on votes');
select ok(not has_table_privilege('authenticated', 'public.inbox', 'update'), 'no direct update on inbox');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'insert'), 'no direct insert on notifications');
select ok(not has_table_privilege('authenticated', 'app.settings', 'select'), 'settings are not readable by authenticated');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'status', 'update'), 'status is not updatable by a person');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'clerk_user_id', 'update'), 'clerk_user_id is not updatable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'deleted_at', 'update'), 'deleted_at is not updatable');
select ok(has_column_privilege('authenticated', 'public.profiles', 'school_id', 'update'), 'school_id is updatable');
select ok(not has_function_privilege('authenticated', 'app.enqueue_notification(uuid, public.notif_template, jsonb, smallint, text, timestamptz)', 'execute'), 'people cannot enqueue mail');
select ok(not has_function_privilege('anon', 'app.register_for_event(uuid, jsonb, jsonb)', 'execute'), 'anon cannot register');
select ok(has_function_privilege('authenticated', 'app.register_for_event(uuid, jsonb, jsonb)', 'execute'), 'authenticated can register');
select ok(has_function_privilege('anon', 'app.subscribe(text, text, text, text)', 'execute'), 'anon can subscribe to the newsletter');

-- every function in app is security definer with an empty search_path unless it is a plain immutable helper or a trigger
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false)), 0::bigint, 'security definer functions all pin search_path to empty');

-- storage buckets
select results_eq($$select id, public, file_size_limit, allowed_mime_types @> array['image/webp'] and not allowed_mime_types @> array['image/svg+xml'] from storage.buckets where id in ('avatars','posters') order by id$$,
  $$values ('avatars'::text, false, 1048576::bigint, true), ('posters'::text, true, 5242880::bigint, true)$$, 'avatars private 1 MB, posters public, no SVG');
select is((select count(*) from storage.buckets where id = 'private-docs' and not public), 1::bigint, 'private-docs is private');

select * from finish();
rollback;
