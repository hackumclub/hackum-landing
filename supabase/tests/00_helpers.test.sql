-- Test helpers (schema `tests`, committed so the following files can use them; recreated by every `supabase db reset`).
-- Never part of a migration: this schema does not exist in production.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Pin the Clerk issuer for the transaction (rolled back with the test).
create or replace function tests.use_issuer(p_issuer text default 'https://clerk.test') returns void language sql as $$
  insert into app.settings (key, value) values ('clerk_issuer', p_issuer) on conflict (key) do update set value = excluded.value
$$;

-- Fixtures: written as the table owner (bypass RLS), exactly like an import script would.
create or replace function tests.profile(
  p_handle text, p_status public.member_status default 'guest', p_school public.school_id default 'num',
  p_track public.major_track default 'software', p_onboarded boolean default true, p_visibility public.visibility default 'members'
) returns uuid language sql as $$
  insert into public.profiles (handle, clerk_user_id, email, name, status, school_id, school, major_track, visibility, onboarded_at)
  values (p_handle, 'user_' || p_handle, p_handle || '@example.test', jsonb_build_object('mn', 'Нэр ' || p_handle, 'en', 'Name ' || p_handle),
    p_status, p_school, p_school::text, p_track, p_visibility, case when p_onboarded then now() end)
  returning id
$$;

create or replace function tests.staff(p_handle text, p_role public.staff_role default 'organizer') returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := tests.profile(p_handle, 'member');
  insert into public.staff_roles (profile_id, role) values (v_id, p_role);
  return v_id;
end $$;

create or replace function tests.event(
  p_slug text, p_capacity integer default null, p_status public.event_status default 'published', p_starts_in interval default '10 days',
  p_reg_mode public.reg_mode default 'rsvp', p_audience public.event_audience default 'open', p_scope public.school_scope default 'all',
  p_waitlist boolean default true, p_questions jsonb default '[]', p_team_mode public.team_mode default 'none', p_team_max integer default 1
) returns uuid language sql as $$
  insert into public.events (slug, kind, title, starts_at, ends_at, status, capacity, reg_mode, audience, school_scope, waitlist, questions,
    team_mode, team_size_min, team_size_max, decision_deadline)
  values (p_slug, 'workshop', jsonb_build_object('mn', 'Арга хэмжээ ' || p_slug, 'en', 'Event ' || p_slug), now() + p_starts_in,
    now() + p_starts_in + interval '2 hours', p_status, p_capacity, p_reg_mode, p_audience, p_scope, p_waitlist, p_questions, p_team_mode,
    1, p_team_max, case when p_reg_mode = 'application' then now() + interval '5 days' end)
  returning id
$$;

-- Switch identity for the rest of the transaction.
create or replace function tests.as_person(p_handle text, p_issuer text default 'https://clerk.test') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', 'user_' || p_handle, 'iss', p_issuer, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.as_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

create or replace function tests.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Row counts as the table owner whatever identity is active (for assertions about stored state).
create or replace function tests.count(p_sql text) returns bigint language plpgsql security definer as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n;
end $$;

-- Scalar as the table owner, whatever identity is active.
create or replace function tests.val(p_sql text) returns text language plpgsql security definer as $$
declare v text;
begin
  execute p_sql into v;
  return v;
end $$;

create or replace function tests.pid(p_handle text) returns uuid language sql security definer stable as $$
  select id from public.profiles where handle = p_handle
$$;
create or replace function tests.eid(p_slug text) returns uuid language sql security definer stable as $$
  select id from public.events where slug = p_slug
$$;

create or replace function tests.team_code(p_name text) returns text language sql security definer stable as $$
  select invite_code from public.teams where name = p_name
$$;

-- A valid organizer payload for create_event / update_event, with overrides merged on top.
create or replace function tests.ei(p_over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('slug', 'knowledge-day-7', 'kind', 'knowledge_day', 'title', jsonb_build_object('mn', 'Мэдлэгийн өдөр', 'en', 'Knowledge Day'),
    'tagline', jsonb_build_object('mn', '', 'en', ''), 'description', jsonb_build_object('mn', 'Тайлбар', 'en', 'Text'),
    'starts_at', now() + interval '100 hours', 'ends_at', now() + interval '102 hours', 'mode', 'offline', 'venue_name', 'МУИС 305', 'audience', 'open',
    'school_scope', 'all', 'capacity', 50, 'waitlist', true, 'reg_mode', 'rsvp', 'questions', '[]'::jsonb, 'team_mode', 'none', 'team_size_min', 1,
    'team_size_max', 1, 'themes', '[]'::jsonb) || p_over
$$;

create or replace function tests.poll(p_title text) returns uuid language sql security definer stable as $$
  select id from public.polls where title ->> 'mn' = p_title or title ->> 'en' = p_title order by created_at limit 1
$$;

-- Rows touched by a DML statement, run with the CURRENT identity (so RLS applies).
create or replace function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to public;

select plan(1);
select ok(true, 'helpers installed');
select * from finish();
