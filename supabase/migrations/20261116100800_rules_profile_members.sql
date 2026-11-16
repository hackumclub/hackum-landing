-- 9/12 rule functions: profile, academic, onboarding, membership, roles, seasons
-- (ports of profile.ts, academic.ts, avatars.ts, members.ts, ext-membership.ts, ext-subscribe.ts, forms.ts).

create function app.display_name(p public.profiles) returns text
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(nullif(p.name ->> 'mn', ''), p.name ->> 'en')
$$;

-- name object -> trimmed {mn,en}; raises invalid when mn is empty or a part is longer than 80.
create function app.clean_name(p_name jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare mn text; en text;
begin
  if p_name is null or jsonb_typeof(p_name) <> 'object' or jsonb_typeof(p_name -> 'mn') is distinct from 'string' then perform app.fail('invalid'); end if;
  mn := btrim(p_name ->> 'mn');
  en := btrim(coalesce(p_name ->> 'en', ''));
  if mn = '' or length(mn) > 80 or length(en) > 80 then perform app.fail('invalid'); end if;
  return jsonb_build_object('mn', mn, 'en', en);
end $$;

create function app.complete_onboarding(p_name jsonb, p_school text, p_grad_year integer, p_locale text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_school text := btrim(coalesce(p_school, '')); v_name jsonb; v_first boolean;
begin
  me := app.require_profile();
  v_name := app.clean_name(p_name);
  if length(v_school) < 1 or length(v_school) > 80 then perform app.fail('invalid'); end if;
  if p_grad_year is null or p_grad_year < 2000 or p_grad_year > 2040 then perform app.fail('invalid'); end if;
  if p_locale not in ('mn', 'en') then perform app.fail('invalid'); end if;
  v_first := me.onboarded_at is null;
  update public.profiles set name = v_name, school = v_school, grad_year = p_grad_year, locale = p_locale,
    onboarded_at = case when v_first then now() else onboarded_at end
  where id = me.id;
  if v_first then
    perform app.enqueue_notification(me.id, 'welcome', jsonb_build_object('to_name', v_name ->> 'mn'), 0::smallint, 'welcome:' || me.id::text);
  end if;
end $$;

create function app.update_prefs(p_notif_prefs jsonb, p_locale text, p_visibility text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; k text;
begin
  me := app.require_profile();
  if p_notif_prefs is null or jsonb_typeof(p_notif_prefs) <> 'object' or p_locale not in ('mn', 'en') then perform app.fail('invalid'); end if;
  foreach k in array array['reminders', 'updates', 'announcements'] loop
    if jsonb_typeof(p_notif_prefs -> k) is distinct from 'boolean' then perform app.fail('invalid'); end if;
  end loop;
  begin
    update public.profiles set
      notif_prefs = jsonb_build_object('reminders', p_notif_prefs -> 'reminders', 'updates', p_notif_prefs -> 'updates', 'announcements', p_notif_prefs -> 'announcements'),
      locale = p_locale, visibility = p_visibility::public.visibility
    where id = me.id;
  exception when invalid_text_representation then perform app.fail('invalid');
  end;
end $$;

create function app.update_profile(p_name jsonb, p_grad_year integer, p_links jsonb, p_visibility text, p_locale text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_name jsonb; v_links jsonb := '{}'::jsonb; e record; v text;
begin
  me := app.require_profile();
  v_name := app.clean_name(p_name);
  if p_grad_year is not null and (p_grad_year < 2000 or p_grad_year > 2040) then perform app.fail('invalid'); end if;
  if p_visibility not in ('public', 'members', 'private') or p_locale not in ('mn', 'en') then perform app.fail('invalid'); end if;
  if p_links is null or jsonb_typeof(p_links) <> 'object' then perform app.fail('invalid'); end if;
  for e in select key, value from jsonb_each(p_links) loop
    if jsonb_typeof(e.value) <> 'string' then perform app.fail('invalid'); end if;
    v := btrim(e.value #>> '{}');
    if v = '' then continue; end if;
    if e.key !~ '^[a-z]{2,20}$' or length(v) > 200 or v !~* '^https://[^\s/?#]+([/?#]\S*)?$' then perform app.fail('invalid'); end if;
    v_links := v_links || jsonb_build_object(e.key, v);
  end loop;
  if (select count(*) from jsonb_object_keys(v_links)) > 6 then perform app.fail('invalid'); end if;
  update public.profiles set name = v_name, grad_year = p_grad_year, links = v_links, visibility = p_visibility::public.visibility, locale = p_locale where id = me.id;
  perform app.audit('profile.update', 'profiles', me.id::text);
end $$;

-- School and major of the caller. Only NUM has a program list, so a program index is kept for NUM alone.
create function app.update_academic(p_school_id text, p_school_name text, p_major_track text, p_program_index text, p_major_label text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_sid public.school_id; v_track public.major_track; v_name text := btrim(coalesce(p_school_name, '')); v_label text := btrim(coalesce(p_major_label, '')); v_prog text; v_school text;
begin
  me := app.require_profile();
  begin
    v_sid := p_school_id::public.school_id; v_track := p_major_track::public.major_track;
  exception when invalid_text_representation or null_value_not_allowed then perform app.fail('invalid');
  end;
  if v_sid is null or v_track is null or length(v_label) > 80 or length(v_name) > 80 then perform app.fail('invalid'); end if;
  if v_sid = 'other' and length(v_name) < 1 then perform app.fail('invalid'); end if;
  v_prog := case when v_sid = 'num' then nullif(btrim(coalesce(p_program_index, '')), '') end;
  if v_prog is not null and length(v_prog) > 20 then perform app.fail('invalid'); end if;
  v_school := case v_sid
    when 'num' then 'МУИС' when 'must' then 'ШУТИС'
    when 'ufe' then 'Санхүү, эдийн засгийн их сургууль' when 'mnums' then 'Анагаахын шинжлэх ухааны үндэсний их сургууль'
    else v_name end;
  update public.profiles set school_id = v_sid, school = v_school, major_track = v_track, program_index = v_prog, major = nullif(v_label, '') where id = me.id;
  perform app.audit('profile.academic', 'profiles', me.id::text, jsonb_build_object('school_id', v_sid, 'major_track', v_track));
end $$;

create function app.set_semester_subjects(p_year integer, p_term text, p_subjects text[], p_shared boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_term public.term; s text; raw text; subjects text[] := '{}'::text[]; seen text[] := '{}'::text[];
begin
  me := app.require_profile();
  if p_year is null or p_year < 2000 or p_year > 2100 then perform app.fail('invalid'); end if;
  begin v_term := p_term::public.term; exception when invalid_text_representation or null_value_not_allowed then perform app.fail('invalid'); end;
  foreach raw in array coalesce(p_subjects, '{}') loop
    s := btrim(coalesce(raw, ''));
    if s = '' then continue; end if;
    if length(s) > 80 then perform app.fail('invalid'); end if;
    if lower(s) = any (seen) then continue; end if;
    seen := seen || lower(s);
    subjects := subjects || s;
  end loop;
  if cardinality(subjects) > 12 then perform app.fail('invalid'); end if;
  insert into public.profile_semesters (profile_id, year, term, subjects, shared) values (me.id, p_year, v_term, subjects, coalesce(p_shared, false))
  on conflict (profile_id, year, term) do update set subjects = excluded.subjects, shared = excluded.shared;
  return jsonb_build_object('profile_id', me.id, 'year', p_year, 'term', v_term, 'subjects', to_jsonb(subjects), 'shared', coalesce(p_shared, false));
end $$;

-- Storage replaces the mock's blob map: the app uploads to bucket `avatars` (object name = profile id), then records the path here.
create function app.set_avatar_path(p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_profile();
  if p_path is null or length(p_path) > 200 or not (p_path = me.id::text or p_path like me.id::text || '/%') then perform app.fail('invalid'); end if;
  update public.profiles set avatar_path = p_path where id = me.id;
  perform app.audit('profile.avatar', 'profiles', me.id::text);
end $$;

create function app.remove_avatar() returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := app.require_profile();
  if me.avatar_path is not null then
    update public.profiles set avatar_path = null where id = me.id;
    perform app.audit('profile.avatar_removed', 'profiles', me.id::text);
  end if;
end $$;

-- ── membership ─────────────────────────────────────────────────────────────────────────────────────────────────────

create function app.apply_for_membership(p_motivation text, p_team_interest text[] default '{}', p_answers jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_mot text := btrim(coalesce(p_motivation, '')); v_answers jsonb; season public.seasons; v_id uuid;
begin
  me := app.require_profile(true);
  if length(v_mot) < 10 or length(v_mot) > 1000 then perform app.fail('invalid'); end if;
  -- The club's own questions (staff edit them under Forms); answers to unknown ones are dropped.
  v_answers := app.parse_answers(coalesce((select f.questions from public.forms f where f.id = 'membership_application'), '[]'), coalesce(p_answers, '{}'));
  if me.status = 'member' then perform app.fail('conflict'); end if;
  -- Membership is for National University of Mongolia students who have chosen a major; everyone else stays a guest.
  if me.school_id is distinct from 'num' or me.major_track is null then perform app.fail('ineligible'); end if;
  season := app.open_season();
  if season.year is null then perform app.fail('closed'); end if;
  if exists (select 1 from public.membership_applications a where a.profile_id = me.id and a.season = season.year) then perform app.fail('conflict'); end if;
  begin
    insert into public.membership_applications (profile_id, season, motivation, team_interest, answers)
    values (me.id, season.year, v_mot, coalesce(p_team_interest[1:6], '{}'), v_answers) returning id into v_id;
  exception when unique_violation then perform app.fail('conflict');
  end;
  perform app.audit('membership.apply', 'membership_applications', v_id::text, jsonb_build_object('season', season.year));
  perform app.notify_staff('staff_application', jsonb_build_object('application_id', v_id, 'profile_id', me.id, 'name', app.display_name(me)), 'staffapp:' || v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

-- A current member asks to stay for the season whose window is open: same queue for staff, no motivation text.
create function app.renew_membership(p_team_interest text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; season public.seasons; v_id uuid;
begin
  me := app.require_profile(true);
  if me.status <> 'member' then perform app.fail('conflict'); end if;
  if me.school_id is distinct from 'num' then perform app.fail('ineligible'); end if;
  season := app.open_season();
  if season.year is null then perform app.fail('closed'); end if;
  if exists (select 1 from public.memberships m where m.profile_id = me.id and m.season = season.year) then perform app.fail('conflict'); end if;
  if exists (select 1 from public.membership_applications a where a.profile_id = me.id and a.season = season.year and a.status <> 'withdrawn') then perform app.fail('conflict'); end if;
  begin
    insert into public.membership_applications (profile_id, season, motivation, team_interest, answers)
    values (me.id, season.year, 'Renewal', coalesce(p_team_interest[1:6], '{}'), '{}') returning id into v_id;
  exception when unique_violation then perform app.fail('conflict');
  end;
  perform app.audit('membership.renew', 'membership_applications', v_id::text, jsonb_build_object('season', season.year));
  perform app.notify_staff('staff_application', jsonb_build_object('application_id', v_id, 'profile_id', me.id, 'name', app.display_name(me)), 'staffapp:' || v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create function app.review_membership(p_id uuid, p_approve boolean, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare staff public.profiles; a public.membership_applications; person public.profiles; v_status public.application_status;
begin
  staff := app.require_staff();
  select * into a from public.membership_applications x where x.id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  select * into person from public.profiles where id = a.profile_id and deleted_at is null for update;
  if not found then perform app.fail('not_found'); end if;
  if a.status <> 'pending' then perform app.fail('conflict'); end if;
  -- Same rule as applying: only NUM students with a major become members (rejecting stays possible).
  if p_approve and (person.school_id is distinct from 'num' or person.major_track is null) then perform app.fail('ineligible'); end if;
  v_status := (case when p_approve then 'approved' else 'rejected' end)::public.application_status;
  update public.membership_applications set status = v_status, reviewed_by = staff.id, reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), '') where id = a.id;
  if p_approve then
    insert into public.memberships (profile_id, season, team) values (person.id, a.season, a.team_interest[1]) on conflict (profile_id, season) do nothing;
    update public.profiles set status = 'member' where id = person.id;
  end if;
  -- The staff note is never part of the email payload.
  perform app.enqueue_notification(person.id, case when p_approve then 'membership_approved' else 'membership_rejected' end::public.notif_template,
    jsonb_build_object('to_name', app.display_name(person), 'season', a.season), 0::smallint, 'membership:' || a.id::text || ':' || v_status::text);
  perform app.audit(case when p_approve then 'membership.approve' else 'membership.reject' end, 'membership_applications', a.id::text, jsonb_build_object('season', a.season));
end $$;

create function app.set_member_status(p_ids uuid[], p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_status public.member_status; r public.profiles; changed integer := 0;
begin
  perform app.require_staff();
  begin v_status := p_status::public.member_status; exception when invalid_text_representation or null_value_not_allowed then perform app.fail('invalid'); end;
  for r in select * from public.profiles x where x.id = any (p_ids) and x.deleted_at is null and x.status <> v_status order by x.id for update loop
    perform app.audit('member.status', 'profiles', r.id::text, jsonb_build_object('status', jsonb_build_array(r.status, v_status)));
    update public.profiles set status = v_status where id = r.id;
    changed := changed + 1;
  end loop;
  return jsonb_build_object('changed', changed);
end $$;

-- Whoever is an admin may be demoted or removed, but never by themselves and never the last one (the club keeps an admin).
create function app.grant_role(p_profile_id uuid, p_role text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare admin public.profiles; cur public.staff_roles; v_role public.staff_role; demoting boolean;
begin
  admin := app.require_staff(true);
  perform pg_advisory_xact_lock(hashtext('hackum.staff_roles'));
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.deleted_at is null) then perform app.fail('not_found'); end if;
  if p_role is not null then
    begin v_role := p_role::public.staff_role; exception when invalid_text_representation then perform app.fail('invalid'); end;
  end if;
  select * into cur from public.staff_roles where profile_id = p_profile_id;
  demoting := found and cur.role = 'admin' and v_role is distinct from 'admin';
  if demoting and (p_profile_id = admin.id or (select count(*) from public.staff_roles where role = 'admin') <= 1) then perform app.fail('conflict'); end if;
  delete from public.staff_roles where profile_id = p_profile_id;
  if v_role is not null then
    insert into public.staff_roles (profile_id, role, granted_by) values (p_profile_id, v_role, admin.id);
  end if;
  perform app.audit('staff.role', 'staff_roles', p_profile_id::text, jsonb_build_object('role', v_role));
end $$;

create function app.upsert_season(p_input jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_year integer; v_label jsonb; v_open timestamptz; v_close timestamptz; v_current boolean; cur public.seasons;
begin
  perform app.require_staff(true);
  begin
    v_year := (p_input ->> 'year')::integer;
    v_label := p_input -> 'label';
    v_open := nullif(p_input ->> 'application_opens_at', '')::timestamptz;
    v_close := nullif(p_input ->> 'application_closes_at', '')::timestamptz;
    v_current := coalesce((p_input ->> 'is_current')::boolean, false);
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then perform app.fail('invalid');
  end;
  if v_year is null or v_year < 2000 or v_year > 2100 or not app.is_l(v_label) then perform app.fail('invalid'); end if;
  if v_open is not null and v_close is not null and v_open >= v_close then perform app.fail('invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('hackum.seasons'));
  select * into cur from public.seasons where year = v_year;
  -- Un-marking the only current season would leave the club with none: make another season current instead.
  if found and cur.is_current and not v_current then perform app.fail('conflict'); end if;
  if v_current then update public.seasons set is_current = false where is_current; end if;
  insert into public.seasons (year, label, application_opens_at, application_closes_at, is_current) values (v_year, v_label, v_open, v_close, v_current)
  on conflict (year) do update set label = excluded.label, application_opens_at = excluded.application_opens_at,
    application_closes_at = excluded.application_closes_at, is_current = excluded.is_current;
  perform app.audit('season.upsert', 'seasons', v_year::text, jsonb_build_object('is_current', v_current));
end $$;

-- ── forms and the public newsletter ────────────────────────────────────────────────────────────────────────────────

create function app.update_form(p_id text, p_questions jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare staff public.profiles; f public.forms; before_n integer;
begin
  staff := app.require_staff();
  select * into f from public.forms where id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  if not app.valid_questions(p_questions) then perform app.fail('invalid'); end if;
  before_n := jsonb_array_length(f.questions);
  update public.forms set questions = p_questions, updated_by = staff.id where id = p_id returning * into f;
  perform app.audit('form.update', 'forms', p_id, jsonb_build_object('questions', jsonb_build_array(before_n, jsonb_array_length(p_questions))));
  return to_jsonb(f);
end $$;

-- Answers to the "Join Hackum" form, one submission per person (the newest wins).
create function app.submit_join_form(p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; v_answers jsonb; v_id uuid;
begin
  me := app.require_profile();
  v_answers := app.parse_answers(coalesce((select f.questions from public.forms f where f.id = 'join'), '[]'), p_answers);
  insert into public.form_submissions (form_id, profile_id, answers) values ('join', me.id, v_answers)
  on conflict (form_id, profile_id) do update set answers = excluded.answers, created_at = now() returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- Newsletter sign-up: the one write the public site makes without a signed-in person. A repeated address (any letter case)
-- is a success that changes nothing, and the function returns nothing, so the endpoint cannot be used to find out who is subscribed.
create function app.subscribe(p_name text, p_email text, p_lang text default 'mn', p_source text default 'join_page') returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); v_email text := lower(btrim(coalesce(p_email, ''))); v_src text;
begin
  if length(v_name) < 1 or length(v_name) > 80 or v_name ~ '[[:cntrl:]]'
     or length(v_email) < 6 or length(v_email) > 254 or v_email ~ '[[:cntrl:]]'
     or v_email !~ '^[^\s@<>()\[\]\\,;:"]{1,64}@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
     or p_lang not in ('mn', 'en') then
    perform app.fail('invalid');
  end if;
  v_src := case when p_source in ('join_page', 'footer', 'event_page') then p_source else 'join_page' end;
  insert into public.subscribers (email, name, lang, source) values (v_email, v_name, p_lang, v_src) on conflict (email) do nothing;
end $$;
