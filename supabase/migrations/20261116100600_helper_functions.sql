-- 7/12 helper functions: identity, roles, error convention, audit, outbox/inbox writers, validators.
--
-- Error convention (mirrors src/lib/result.ts ErrorCode): every rule function fails with
--   raise exception using errcode = 'P0001', message = '<code>'
-- where <code> is exactly one of: unauthenticated forbidden not_found invalid conflict full closed rate_limited ineligible server.
-- All functions are security definer + `set search_path = ''`, so every object below is schema-qualified.

create function app.fail(p_code text) returns void
language plpgsql set search_path = '' as $$
begin
  if p_code is null or p_code not in ('unauthenticated','forbidden','not_found','invalid','conflict','full','closed','rate_limited','ineligible','server') then
    p_code := 'server';
  end if;
  raise exception using errcode = 'P0001', message = p_code;
end $$;

-- JS Date.toISOString() format: the outbox payloads hold times in this shape, and the dispatcher compares them as strings.
create function app.iso(p_at timestamptz) returns text
language sql immutable parallel safe set search_path = '' as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- Ulaanbaatar calendar day (UTC+8): the key of email_daily_usage.
create function app.ub_day(p_at timestamptz) returns date
language sql immutable parallel safe set search_path = '' as $$
  select (p_at at time zone 'Asia/Ulaanbaatar')::date
$$;

-- The Clerk issuer the JWT must carry. Configure with:  insert into app.settings (key, value) values ('clerk_issuer', 'https://<clerk-frontend-api>');
-- (a database-level `alter database postgres set app.clerk_issuer = '...'` also works; the table wins). Not configured = nobody signed in passes.
create function app.clerk_issuer() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select nullif(s.value, '') from app.settings s where s.key = 'clerk_issuer'),
    nullif(current_setting('app.clerk_issuer', true), '')
  )
$$;

create function app.jwt_issuer_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.clerk_issuer() is not null and (auth.jwt() ->> 'iss') = app.clerk_issuer()
$$;

-- Clerk user id (text, not a uuid) -> profile. Deleted (anonymised) profiles never resolve; a wrong issuer resolves to nobody.
create function app.current_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.profiles p
  where p.clerk_user_id = (auth.jwt() ->> 'sub')
    and p.deleted_at is null
    and app.jwt_issuer_ok()
$$;

-- Roles live in the database (never in the token), so a revoked role takes effect on the next request.
create function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles r where r.profile_id = app.current_profile_id())
$$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles r where r.profile_id = app.current_profile_id() and r.role = 'admin')
$$;

-- Guards shared by every rule: return the acting profile (row), or raise the error to hand straight back.
create function app.require_profile(p_onboarded boolean default false) returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  select * into me from public.profiles p where p.id = app.current_profile_id();
  if not found then perform app.fail('unauthenticated'); end if;
  if p_onboarded and me.onboarded_at is null then perform app.fail('forbidden'); end if;
  return me;
end $$;

create function app.require_staff(p_admin boolean default false) returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare me public.profiles;
begin
  select * into me from public.profiles p where p.id = app.current_profile_id();
  if not found then perform app.fail('unauthenticated'); end if;
  if not (case when p_admin then app.is_admin() else app.is_staff() end) then perform app.fail('forbidden'); end if;
  return me;
end $$;

-- Every staff action writes exactly one audit row, from the rule function itself (no audit triggers on those tables).
create function app.audit(p_action text, p_entity text, p_entity_id text, p_diff jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_profile_id, action, entity, entity_id, diff)
  values (app.current_profile_id(), p_action, p_entity, p_entity_id, coalesce(p_diff, '{}'));
end $$;

-- Which notification preference silences a template (others are always delivered). Same table as core.ts PREF_OF.
create function app.pref_of(p_template public.notif_template) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case p_template
    when 'reminder_24h' then 'reminders'
    when 'event_updated' then 'updates'
    when 'announcement' then 'announcements'
    when 'feedback_request' then 'reminders'
    when 'poll_opened' then 'announcements'
  end
$$;

-- In-app notification. A repeated dedupe key is a no-op. Returns whether a row was added.
create function app.push_inbox(p_profile uuid, p_kind public.inbox_kind, p_payload jsonb, p_dedupe text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.inbox (profile_id, kind, payload, dedupe_key) values (p_profile, p_kind, coalesce(p_payload, '{}'), p_dedupe)
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Every staff member gets the item (new application, mail that gave up).
create function app.notify_staff(p_kind public.inbox_kind, p_payload jsonb, p_dedupe text) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select s.profile_id from public.staff_roles s join public.profiles p on p.id = s.profile_id and p.deleted_at is null loop
    perform app.push_inbox(r.profile_id, p_kind, p_payload, p_dedupe || ':' || r.profile_id::text);
  end loop;
end $$;

-- Outbox insert; a repeated dedupe key is a no-op (same contract as core.enqueue). The message also lands in the person's
-- in-app list unless they switched that kind off. Internal: granted to service_role only, never to people.
create function app.enqueue_notification(
  p_profile uuid, p_template public.notif_template, p_payload jsonb, p_priority smallint, p_dedupe text, p_at timestamptz default now()
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer; who public.profiles; pref text;
begin
  insert into public.notifications (profile_id, channel, template, payload, priority, scheduled_at, dedupe_key)
  values (p_profile, 'email', p_template, coalesce(p_payload, '{}'), p_priority, coalesce(p_at, now()), p_dedupe)
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  select * into who from public.profiles p where p.id = p_profile and p.deleted_at is null;
  pref := app.pref_of(p_template);
  if found and not (pref is not null and who.notif_prefs -> pref = 'false'::jsonb) then
    perform app.push_inbox(who.id, p_template::text::public.inbox_kind, p_payload, p_dedupe);
  end if;
  return true;
end $$;

-- `to_name` etc. as the email renderer expects (keys fixed by src/emails/render.ts).
create function app.event_payload(ev public.events, p public.profiles) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'to_name', coalesce(nullif(p.name ->> 'mn', ''), p.name ->> 'en'),
    'event_id', ev.id, 'event_slug', ev.slug,
    'event_title_mn', ev.title ->> 'mn', 'event_title_en', ev.title ->> 'en',
    'starts_at', app.iso(ev.starts_at), 'ends_at', app.iso(ev.ends_at),
    'venue', ev.venue_name, 'mode', ev.mode, 'ics_sequence', ev.ics_sequence)
$$;

create function app.going_count(p_event uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.event_registrations r where r.event_id = p_event and r.status in ('going', 'attended')
$$;

-- The season whose application window contains now (the one people can apply to).
create function app.open_season(p_now timestamptz default now()) returns public.seasons
language sql stable security definer set search_path = '' as $$
  select s from public.seasons s
  where s.application_opens_at is not null and s.application_closes_at is not null
    and s.application_opens_at <= p_now and p_now <= s.application_closes_at
  order by s.year desc limit 1
$$;

-- Visibility helpers used by RLS policies (security definer so a policy on table A can look at table B without recursion).
-- The profiles the caller may see in directories: public ones, plus members-visibility ones for signed-in people. A set with no
-- argument (never "is profile X visible?"), so it cannot be used to probe a chosen person.
create function app.visible_profile_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p
  where p.deleted_at is null
    and (p.visibility = 'public' or (p.visibility = 'members' and app.current_profile_id() is not null))
$$;

create function app.is_seated(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_registrations r
    where r.event_id = p_event and r.profile_id = app.current_profile_id() and r.status in ('going', 'attended'))
$$;

create function app.has_registration(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_registrations r where r.event_id = p_event and r.profile_id = app.current_profile_id())
$$;

create function app.my_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select t.id from public.teams t where t.captain_profile_id = app.current_profile_id()
  union
  select r.team_id from public.event_registrations r
  where r.profile_id = app.current_profile_id() and r.team_id is not null and r.status <> 'cancelled'
$$;

-- Poll audience: onboarded, not deleted; members -> status member; community -> member or alumni; everyone.
-- poll_eligible_for takes any profile id, so it is internal (security definer rule functions only, never granted to API roles).
create function app.poll_eligible_for(p_audience public.poll_audience, p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile and p.deleted_at is null and p.onboarded_at is not null
      and (p_audience = 'everyone'
        or (p_audience = 'members' and p.status = 'member')
        or (p_audience = 'community' and p.status in ('member', 'alumni')))
  )
$$;

-- The version policies and the API may call: it only ever looks at the caller.
create function app.poll_eligible_me(p_audience public.poll_audience) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.poll_eligible_for(p_audience, app.current_profile_id())
$$;

-- Polls whose voters staff may see (not anonymous). No argument, empty unless the caller is staff.
create function app.staff_votable_poll_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select pl.id from public.polls pl where not pl.anonymous and app.is_staff()
$$;

-- ── question / answer validation (port of src/lib/events/questions.ts: questionsSchema + answersSchema) ───────────────────

create function app.is_l(p jsonb, p_mn_required boolean default true) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(
    jsonb_typeof(p) = 'object'
    and jsonb_typeof(p -> 'mn') = 'string' and jsonb_typeof(p -> 'en') = 'string'
    and length(btrim(p ->> 'mn')) <= 200 and length(btrim(p ->> 'en')) <= 200
    and (not p_mn_required or length(btrim(p ->> 'mn')) >= 1), false)
$$;

create function app.valid_questions(q jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare el jsonb; seen text[] := '{}'::text[]; qid text; typ text; opt jsonb;
begin
  if q is null or jsonb_typeof(q) is distinct from 'array' or jsonb_array_length(q) > 20 then return false; end if;
  for el in select value from jsonb_array_elements(q) loop
    if jsonb_typeof(el) <> 'object' then return false; end if;
    qid := el ->> 'id'; typ := el ->> 'type';
    if qid is null or qid !~ '^[a-z0-9_]{1,32}$' or qid = any (seen) then return false; end if;
    seen := seen || qid;
    if typ is null or typ not in ('short', 'long', 'select', 'multi', 'checkbox', 'url') then return false; end if;
    if jsonb_typeof(el -> 'required') is distinct from 'boolean' then return false; end if;
    if not app.is_l(el -> 'label') then return false; end if;
    if el ? 'options' and jsonb_typeof(el -> 'options') <> 'null' then
      if jsonb_typeof(el -> 'options') <> 'array' or jsonb_array_length(el -> 'options') > 20 then return false; end if;
      for opt in select value from jsonb_array_elements(el -> 'options') loop
        if not app.is_l(opt) then return false; end if;
      end loop;
    end if;
    if typ in ('select', 'multi') and coalesce(jsonb_array_length(case when jsonb_typeof(el -> 'options') = 'array' then el -> 'options' end), 0) < 2 then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- Validates `raw` against the questions and returns the cleaned answers (unknown keys dropped, empty optional answers
-- omitted). Raises 'invalid' on the first problem; the app's zod schema reports the per-question reason before this runs.
create function app.parse_answers(q jsonb, raw jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  el jsonb; qid text; typ text; req boolean; v jsonb; s text; n integer; out jsonb := '{}'::jsonb; arr jsonb := '[]'::jsonb; item jsonb;
  blank boolean;
begin
  if raw is null or jsonb_typeof(raw) <> 'object' then perform app.fail('invalid'); end if;
  if q is null or jsonb_typeof(q) <> 'array' then return '{}'::jsonb; end if;
  for el in select value from jsonb_array_elements(q) loop
    qid := el ->> 'id'; typ := el ->> 'type'; req := coalesce((el ->> 'required')::boolean, false);
    v := raw -> qid;
    n := case when jsonb_typeof(el -> 'options') = 'array' then jsonb_array_length(el -> 'options') else 0 end;
    blank := v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '');
    if typ in ('short', 'long', 'url', 'select') then
      if blank then
        if req then perform app.fail('invalid'); end if;
        continue;
      end if;
      if jsonb_typeof(v) <> 'string' then perform app.fail('invalid'); end if;
      s := btrim(v #>> '{}');
      if typ = 'short' and length(s) > 200 then perform app.fail('invalid'); end if;
      if typ = 'long' and length(s) > 2000 then perform app.fail('invalid'); end if;
      if typ = 'url' and (length(s) > 2000 or s !~* '^https?://[^\s/?#]+([/?#]\S*)?$') then perform app.fail('invalid'); end if;
      if typ = 'select' and (s !~ '^(0|[1-9][0-9]*)$' or s::numeric >= n) then perform app.fail('invalid'); end if;
      out := out || jsonb_build_object(qid, s);
    elsif typ = 'multi' then
      if v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
        if req then perform app.fail('invalid'); end if;
        continue;
      end if;
      if jsonb_typeof(v) <> 'array' then perform app.fail('invalid'); end if;
      arr := '[]'::jsonb;
      for item in select value from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^(0|[1-9][0-9]*)$' or (item #>> '{}')::numeric >= n then perform app.fail('invalid'); end if;
        if not arr @> jsonb_build_array(item) then arr := arr || jsonb_build_array(item); end if;
      end loop;
      out := out || jsonb_build_object(qid, arr);
    elsif typ = 'checkbox' then
      if v is null or jsonb_typeof(v) = 'null' then
        if req then perform app.fail('invalid'); end if;
        continue;
      end if;
      if jsonb_typeof(v) <> 'boolean' or (req and v = 'false'::jsonb) then perform app.fail('invalid'); end if;
      out := out || jsonb_build_object(qid, v);
    end if;
  end loop;
  return out;
end $$;

-- Invite codes: HK-XXXX-XXXX-XXXX, 12 characters (60 bits) from a 32-character alphabet without I, O, 0, 1. 256 is divisible by 32,
-- so taking the low five bits of each random byte has no bias. pgcrypto's CSPRNG, never random(). Retried until unused.
create function app.gen_invite_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; code text;
begin
  for attempt in 1..20 loop
    b := extensions.gen_random_bytes(12);
    code := '';
    for i in 0..11 loop
      code := code || substr(alphabet, (get_byte(b, i) & 31) + 1, 1);
      if i in (3, 7) then code := code || '-'; end if;
    end loop;
    code := 'HK-' || code;
    if not exists (select 1 from public.teams t where t.invite_code = code) then return code; end if;
  end loop;
  perform app.fail('server');
  return null;
end $$;

-- What people type or paste -> the stored form. Strips everything that is not a letter or digit, uppercases. HK + 12 -> canonical
-- HK-XXXX-XXXX-XXXX; anything else -> uppercased trimmed input (it will simply not be found). No legacy short codes exist here.
create function app.normalize_invite_code(p_code text) returns text
language plpgsql immutable parallel safe set search_path = '' as $$
declare v text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v ~ '^HK[A-Z0-9]{12}$' then return 'HK-' || substr(v, 3, 4) || '-' || substr(v, 7, 4) || '-' || substr(v, 11, 4); end if;
  return upper(btrim(coalesce(p_code, '')));
end $$;

-- Guess throttling: a join whose code matches nothing inserts a row here inside the same call (and returns {ok:false,error:'not_found'}
-- instead of raising, because a raised error would roll the row back); 10 in an hour block further attempts with `rate_limited`.
-- Private: no policy, no privileges for API roles.
create table app.team_code_failures (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now()
);
create index team_code_failures_profile_at_idx on app.team_code_failures (profile_id, at);
alter table app.team_code_failures enable row level security;
revoke all on app.team_code_failures from public, anon, authenticated;

create function app.team_code_allowed(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(*) from app.team_code_failures f where f.profile_id = p_profile and f.at > now() - interval '1 hour') < 10
$$;

-- Records one miss for the caller. Internal: called by the join functions, never granted (so it cannot be skipped or spammed at others).
create function app.note_team_code_failure(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.team_code_failures (profile_id) values (p_profile);
  delete from app.team_code_failures where profile_id = p_profile and at < now() - interval '1 day';
end $$;
