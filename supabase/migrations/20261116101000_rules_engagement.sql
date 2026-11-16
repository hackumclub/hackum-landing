-- 11/12 rule functions: polls, feedback, inbox, outbox retry, announcements
-- (ports of polls.ts, feedback.ts, notifications.ts, outbox.ts, announce.ts).

-- ── polls ──────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Validated copy of what staff edit. Raises 'invalid'. id, status, created_by, created_at are managed by the rules.
create function app.poll_from_input(p jsonb) returns public.polls
language plpgsql stable set search_path = '' as $$
declare
  keys constant text[] := array['title','description','options','multi','max_choices','audience','anonymous','results','opens_at','closes_at'];
  picked jsonb; r public.polls; o jsonb; seen text[] := '{}'::text[]; n integer;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform app.fail('invalid'); end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}') into picked from jsonb_each(p) e where e.key = any (keys);
  begin
    r := jsonb_populate_record(null::public.polls, picked);
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range
                 or invalid_parameter_value or check_violation or not_null_violation or datatype_mismatch then
    perform app.fail('invalid');
  end;
  r.description := coalesce(r.description, '{"mn":"","en":""}');
  r.multi := coalesce(r.multi, false);
  r.anonymous := coalesce(r.anonymous, false);
  r.audience := coalesce(r.audience, 'members');
  r.results := coalesce(r.results, 'after_vote');
  if r.title is null or btrim(r.title ->> 'mn') = '' or length(r.title ->> 'mn') > 200 or length(r.title ->> 'en') > 200
     or length(r.description ->> 'mn') > 2000 or length(r.description ->> 'en') > 2000 then perform app.fail('invalid'); end if;
  if r.options is null or jsonb_typeof(r.options) <> 'array' then perform app.fail('invalid'); end if;
  n := jsonb_array_length(r.options);
  if n < 2 or n > 10 then perform app.fail('invalid'); end if;
  for o in select value from jsonb_array_elements(r.options) loop
    if jsonb_typeof(o) <> 'object' or jsonb_typeof(o -> 'id') is distinct from 'string' or jsonb_typeof(o -> 'label') is distinct from 'object'
       or (o ->> 'id') !~ '^[a-z0-9_-]{1,24}$' or (o ->> 'id') = any (seen)
       or jsonb_typeof(o -> 'label' -> 'mn') is distinct from 'string' or jsonb_typeof(o -> 'label' -> 'en') is distinct from 'string'
       or btrim(o -> 'label' ->> 'mn') = '' or length(o -> 'label' ->> 'mn') > 120 or length(o -> 'label' ->> 'en') > 120 then
      perform app.fail('invalid');
    end if;
    seen := seen || (o ->> 'id');
  end loop;
  if r.multi then
    if r.max_choices is null or r.max_choices < 1 or r.max_choices > n then perform app.fail('invalid'); end if;
  else
    if r.max_choices is distinct from 1 then
      if r.max_choices is not null then perform app.fail('invalid'); end if;
      r.max_choices := 1;
    end if;
  end if;
  if r.opens_at is not null and r.closes_at is not null and r.closes_at <= r.opens_at then perform app.fail('invalid'); end if;
  return r;
end $$;

create function app.poll_is_open(pl public.polls, p_now timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select pl.status = 'published' and (pl.opens_at is null or p_now >= pl.opens_at) and not (pl.closes_at is not null and p_now >= pl.closes_at)
$$;

create function app.poll_has_ended(pl public.polls, p_now timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select pl.status = 'closed' or (pl.closes_at is not null and p_now >= pl.closes_at)
$$;

create function app.create_poll(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare staff public.profiles; r public.polls; v_id uuid;
begin
  staff := app.require_staff();
  r := app.poll_from_input(p_input);
  insert into public.polls (title, description, options, multi, max_choices, audience, anonymous, results, opens_at, closes_at, status, created_by)
  values (r.title, r.description, r.options, r.multi, r.max_choices, r.audience, r.anonymous, r.results, r.opens_at, r.closes_at, 'draft', staff.id)
  returning id into v_id;
  perform app.audit('poll.create', 'polls', v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create function app.update_poll(p_id uuid, p_input jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare pl public.polls; r public.polls;
begin
  perform app.require_staff();
  select * into pl from public.polls where id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  r := app.poll_from_input(p_input);
  if exists (select 1 from public.poll_votes v where v.poll_id = p_id) then
    -- Once people have voted the ballot itself is frozen; wording and the closing time may still change.
    if (select coalesce(jsonb_agg(o ->> 'id'), '[]') from jsonb_array_elements(pl.options) o)
         is distinct from (select coalesce(jsonb_agg(o ->> 'id'), '[]') from jsonb_array_elements(r.options) o)
       or pl.multi <> r.multi or pl.max_choices <> r.max_choices or pl.audience <> r.audience or pl.anonymous <> r.anonymous then
      perform app.fail('conflict');
    end if;
  end if;
  update public.polls set title = r.title, description = r.description, options = r.options, multi = r.multi, max_choices = r.max_choices,
    audience = r.audience, anonymous = r.anonymous, results = r.results, opens_at = r.opens_at, closes_at = r.closes_at where id = p_id;
  perform app.audit('poll.update', 'polls', p_id::text);
end $$;

create function app.set_poll_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pl public.polls; v_status public.poll_status; allowed boolean; r public.profiles; notified integer := 0;
begin
  perform app.require_staff();
  begin v_status := p_status::public.poll_status; exception when invalid_text_representation or null_value_not_allowed then perform app.fail('invalid'); end;
  select * into pl from public.polls where id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  allowed := case pl.status when 'draft' then v_status = 'published' when 'published' then v_status in ('closed', 'draft') else v_status = 'published' end;
  if not allowed then perform app.fail('conflict'); end if;
  if v_status = 'draft' and exists (select 1 from public.poll_votes v where v.poll_id = p_id) then perform app.fail('conflict'); end if;
  update public.polls set status = v_status where id = p_id;
  if v_status = 'published' then
    for r in select * from public.profiles x where x.deleted_at is null and x.onboarded_at is not null
        and (pl.audience = 'everyone' or (pl.audience = 'members' and x.status = 'member') or (pl.audience = 'community' and x.status in ('member', 'alumni')))
        and x.notif_prefs -> 'announcements' is distinct from 'false'::jsonb order by x.id loop
      -- Deduped per poll and person: closing and re-opening a poll never mails anyone twice.
      if app.enqueue_notification(r.id, 'poll_opened', jsonb_build_object('to_name', app.display_name(r), 'poll_id', pl.id,
           'poll_title_mn', pl.title ->> 'mn', 'poll_title_en', pl.title ->> 'en'), 2::smallint, 'poll:' || pl.id::text || ':' || r.id::text) then
        notified := notified + 1;
      end if;
    end loop;
  end if;
  perform app.audit('poll.status', 'polls', p_id::text, jsonb_build_object('status', jsonb_build_array(pl.status, v_status)));
  return jsonb_build_object('notified', notified);
end $$;

create function app.vote(p_poll_id uuid, p_option_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; pl public.polls; ids text[] := coalesce(p_option_ids, '{}'); known text[];
begin
  me := app.require_profile(true);
  select * into pl from public.polls where id = p_poll_id for share;
  if not found or pl.status = 'draft' then perform app.fail('not_found'); end if;
  if not app.poll_is_open(pl) then perform app.fail('closed'); end if;
  if not app.poll_eligible_for(pl.audience, me.id) then perform app.fail('forbidden'); end if;
  select array_agg(o ->> 'id') into known from jsonb_array_elements(pl.options) o;
  if cardinality(ids) < 1 or cardinality(ids) > (case when pl.multi then pl.max_choices else 1 end)
     or (select count(distinct x) from unnest(ids) x) <> cardinality(ids) or exists (select 1 from unnest(ids) x where x is null or not (x = any (known))) then
    perform app.fail('invalid');
  end if;
  insert into public.poll_votes (poll_id, profile_id, option_ids) values (pl.id, me.id, ids)
  on conflict (poll_id, profile_id) do update set option_ids = excluded.option_ids, updated_at = now();
end $$;

-- Tallies as the viewer may see them (staff always; others per `results`). Voter names only for staff, only if not anonymous.
create function app.poll_tallies(p_poll_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles; pl public.polls; v_staff boolean; mine text[]; ended boolean; visible boolean; v_eligible integer; v_voters integer;
begin
  me := app.require_profile();
  v_staff := app.is_staff();
  select * into pl from public.polls where id = p_poll_id;
  if not found or (pl.status = 'draft' and not v_staff) then perform app.fail('not_found'); end if;
  if not v_staff and not app.poll_eligible_for(pl.audience, me.id) then perform app.fail('forbidden'); end if;
  select v.option_ids into mine from public.poll_votes v where v.poll_id = pl.id and v.profile_id = me.id;
  ended := app.poll_has_ended(pl);
  visible := v_staff or (case pl.results when 'after_vote' then mine is not null or ended when 'after_close' then ended else false end);
  select count(*) into v_voters from public.poll_votes v where v.poll_id = pl.id;
  select count(*) into v_eligible from public.profiles x where x.deleted_at is null and x.onboarded_at is not null
    and (pl.audience = 'everyone' or (pl.audience = 'members' and x.status = 'member') or (pl.audience = 'community' and x.status in ('member', 'alumni')));
  return jsonb_build_object(
    'poll_id', pl.id, 'open', app.poll_is_open(pl), 'visible', visible,
    'tallies', case when visible then (select jsonb_agg(jsonb_build_object('option_id', o ->> 'id',
        'votes', (select count(*) from public.poll_votes v where v.poll_id = pl.id and (o ->> 'id') = any (v.option_ids))) order by ord)
        from jsonb_array_elements(pl.options) with ordinality t(o, ord)) end,
    'voters', v_voters, 'eligible', v_eligible, 'turnout', case when v_eligible > 0 then v_voters::double precision / v_eligible end,
    'my_vote', to_jsonb(mine),
    'voter_list', case when v_staff and not pl.anonymous then
      (select coalesce(jsonb_agg(jsonb_build_object('profile_id', v.profile_id, 'name', p.name, 'option_ids', to_jsonb(v.option_ids)) order by v.created_at), '[]')
         from public.poll_votes v join public.profiles p on p.id = v.profile_id where v.poll_id = pl.id) end);
end $$;

-- ── feedback ───────────────────────────────────────────────────────────────────────────────────────────────────────

create function app.submit_feedback(p_event_id uuid, p_rating integer, p_nps integer, p_went_well text, p_improve text, p_anonymous boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; ev public.events; v_well text := btrim(coalesce(p_went_well, '')); v_improve text := btrim(coalesce(p_improve, '')); v_id uuid;
begin
  me := app.require_profile();
  select * into ev from public.events where id = p_event_id;
  if not found then perform app.fail('not_found'); end if;
  if ev.status <> 'completed' then perform app.fail('closed'); end if;
  if not exists (select 1 from public.event_registrations r where r.event_id = ev.id and r.profile_id = me.id and r.status in ('attended', 'going')) then
    perform app.fail('forbidden');
  end if;
  if not (now() >= ev.ends_at and now() <= ev.ends_at + interval '14 days') then perform app.fail('closed'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 or p_nps is null or p_nps < 0 or p_nps > 10 then perform app.fail('invalid'); end if;
  if length(v_well) > 1000 or length(v_improve) > 1000 then perform app.fail('invalid'); end if;
  insert into public.event_feedback (event_id, profile_id, rating, nps, went_well, improve, anonymous)
  values (ev.id, me.id, p_rating, p_nps, v_well, v_improve, coalesce(p_anonymous, false))
  on conflict (event_id, profile_id) do update set rating = excluded.rating, nps = excluded.nps, went_well = excluded.went_well,
    improve = excluded.improve, anonymous = excluded.anonymous, updated_at = now()
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- Staff view of one event's answers. Names appear only on answers the person did not mark anonymous; raw rows are not readable by staff.
create function app.feedback_summary(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ev public.events; v_n integer; v_eligible integer := 0; v_avg numeric; v_prom integer; v_det integer; dist integer[]; comments jsonb;
begin
  perform app.require_staff();
  select * into ev from public.events where id = p_event_id;
  select count(*), avg(f.rating), count(*) filter (where f.nps >= 9), count(*) filter (where f.nps <= 6)
    into v_n, v_avg, v_prom, v_det from public.event_feedback f where f.event_id = p_event_id;
  if found and ev.status = 'completed' then
    select count(*) into v_eligible from public.event_registrations r join public.profiles p on p.id = r.profile_id and p.deleted_at is null
      where r.event_id = ev.id and r.status in ('attended', 'going');
  end if;
  select array_agg(coalesce(c.n, 0) order by g) into dist from generate_series(1, 5) g
    left join (select rating, count(*)::integer n from public.event_feedback where event_id = p_event_id group by rating) c on c.rating = g;
  select coalesce(jsonb_agg(x.c order by x.at_ts desc, x.id desc, x.k), '[]') into comments from (
    select f.updated_at as at_ts, f.id, 1 as k, jsonb_build_object('kind', 'well', 'text', f.went_well, 'at', app.iso(f.updated_at),
      'author', case when f.anonymous then null else (select p.name from public.profiles p where p.id = f.profile_id and p.deleted_at is null) end) c
      from public.event_feedback f where f.event_id = p_event_id and f.went_well <> ''
    union all
    select f.updated_at, f.id, 2, jsonb_build_object('kind', 'improve', 'text', f.improve, 'at', app.iso(f.updated_at),
      'author', case when f.anonymous then null else (select p.name from public.profiles p where p.id = f.profile_id and p.deleted_at is null) end)
      from public.event_feedback f where f.event_id = p_event_id and f.improve <> '') x;
  return jsonb_build_object('n', v_n, 'eligible', v_eligible,
    'response_rate', case when v_eligible > 0 then v_n::double precision / v_eligible end,
    'avg_rating', case when v_n > 0 then round(floor(v_avg * 10 + 0.5) / 10, 1) end,
    'distribution', to_jsonb(dist),
    'nps', case when v_n > 0 then floor(((v_prom - v_det)::numeric / v_n) * 100 + 0.5) end,
    'comments', comments);
end $$;

-- One hour after an event is completed (for 14 days) everyone who came, and has not answered, is asked once.
create function app.enqueue_feedback_requests(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare ev public.events; r record; p public.profiles; queued integer := 0;
begin
  for ev in select * from public.events e where e.status = 'completed' and p_now >= e.ends_at + interval '1 hour' and p_now <= e.ends_at + interval '14 days' loop
    for r in select x.profile_id from public.event_registrations x where x.event_id = ev.id and x.status in ('attended', 'going')
        and not exists (select 1 from public.event_feedback f where f.event_id = ev.id and f.profile_id = x.profile_id) loop
      select * into p from public.profiles where id = r.profile_id and deleted_at is null;
      if p.id is not null and app.enqueue_notification(p.id, 'feedback_request', app.event_payload(ev, p), 1::smallint, 'feedback:' || ev.id::text || ':' || p.id::text, p_now) then
        queued := queued + 1;
      end if;
    end loop;
  end loop;
  return queued;
end $$;

-- ── inbox and outbox ───────────────────────────────────────────────────────────────────────────────────────────────

-- Marks the caller's own items read; ids that belong to someone else are ignored.
create function app.mark_read(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; n integer;
begin
  me := app.require_profile();
  update public.inbox set read_at = now() where profile_id = me.id and id = any (coalesce(p_ids, '{}')) and read_at is null;
  get diagnostics n = row_count;
  return jsonb_build_object('changed', n);
end $$;

create function app.mark_all_read() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; n integer;
begin
  me := app.require_profile();
  update public.inbox set read_at = now() where profile_id = me.id and read_at is null;
  get diagnostics n = row_count;
  return jsonb_build_object('changed', n);
end $$;

-- Staff: put a failed message back in the queue (the Comms page "Retry" button).
create function app.retry_notification(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.notifications;
begin
  perform app.require_staff();
  select * into n from public.notifications where id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  if n.status <> 'failed' then perform app.fail('conflict'); end if;
  update public.notifications set status = 'queued', attempts = 0, last_error = null, scheduled_at = now() where id = p_id;
  perform app.audit('notification.retry', 'notifications', p_id::text, jsonb_build_object('template', n.template));
end $$;

-- ── announcements ──────────────────────────────────────────────────────────────────────────────────────────────────

-- p_audience: {"kind":"members"|"community"|"everyone"|"subscribers"} or {"kind":"event","event_id":"<uuid>","statuses":["going",...]}.
-- Same key never mails the same person twice; opted-out people are skipped; 5 sends per hour per sender.
create function app.send_announcement(p_key text, p_audience jsonb, p_subject jsonb, p_body jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  staff public.profiles; v_key text := btrim(coalesce(p_key, '')); v_kind text := p_audience ->> 'kind'; v_event uuid; v_statuses text[];
  payload jsonb; queued integer := 0; skipped integer := 0; r record; n integer; recent integer;
begin
  staff := app.require_staff();
  if v_key = '' or length(v_key) > 64 then perform app.fail('invalid'); end if;
  if not coalesce(jsonb_typeof(p_subject) = 'object' and jsonb_typeof(p_body) = 'object', false) then perform app.fail('invalid'); end if;
  if btrim(coalesce(p_subject ->> 'mn', '')) = '' or length(p_subject ->> 'mn') > 120 or length(coalesce(p_subject ->> 'en', '')) > 120 then perform app.fail('invalid'); end if;
  if btrim(coalesce(p_body ->> 'mn', '')) = '' or length(p_body ->> 'mn') > 5000 or length(coalesce(p_body ->> 'en', '')) > 5000 then perform app.fail('invalid'); end if;
  if v_kind is null or v_kind not in ('members', 'community', 'everyone', 'subscribers', 'event') then perform app.fail('invalid'); end if;
  if v_kind = 'event' then
    begin
      v_event := coalesce(p_audience ->> 'event_id', p_audience ->> 'eventId')::uuid;
      select array_agg(s) into v_statuses from jsonb_array_elements_text(p_audience -> 'statuses') s;
    exception when invalid_text_representation or invalid_parameter_value or null_value_not_allowed then perform app.fail('invalid');
    end;
    if v_event is null or not exists (select 1 from public.events e where e.id = v_event) or coalesce(cardinality(v_statuses), 0) = 0
       or exists (select 1 from unnest(v_statuses) s where s not in ('applied', 'going', 'waitlisted', 'rejected', 'attended', 'no_show', 'cancelled')) then
      perform app.fail('invalid');
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('hackum.announce:' || staff.id::text));
  select count(*) into recent from public.audit_log a where a.action = 'announcement.send' and a.actor_profile_id = staff.id and a.at > now() - interval '1 hour';
  if recent >= 5 then perform app.fail('rate_limited'); end if;

  payload := jsonb_build_object('subject_mn', btrim(p_subject ->> 'mn'), 'subject_en', btrim(coalesce(p_subject ->> 'en', '')),
    'body_mn', btrim(p_body ->> 'mn'), 'body_en', btrim(coalesce(p_body ->> 'en', '')));

  if v_kind = 'subscribers' then
    for r in select s.email, s.name from public.subscribers s
        where not exists (select 1 from public.profiles p where p.email is not null and lower(p.email::text) = lower(s.email::text)) order by s.email loop
      insert into public.notifications (to_email, channel, template, payload, priority, dedupe_key)
      values (r.email, 'email', 'announcement', payload || jsonb_build_object('to_name', r.name), 2, 'ann:' || v_key || ':' || lower(r.email::text))
      on conflict (dedupe_key) do nothing;
      get diagnostics n = row_count;
      queued := queued + n;
    end loop;
  else
    for r in select p.id, (p.notif_prefs -> 'announcements') = 'false'::jsonb as opted_out, app.display_name(p) as to_name
        from public.profiles p
        where p.deleted_at is null and p.email is not null
          and (case v_kind
            when 'members' then p.onboarded_at is not null and p.status = 'member'
            when 'community' then p.onboarded_at is not null and p.status in ('member', 'alumni')
            when 'everyone' then p.onboarded_at is not null
            else exists (select 1 from public.event_registrations x where x.event_id = v_event and x.profile_id = p.id
                         and x.status <> 'cancelled' and x.status::text = any (v_statuses)) end)
        order by p.id loop
      if r.opted_out then skipped := skipped + 1; continue; end if;
      if app.enqueue_notification(r.id, 'announcement', payload || jsonb_build_object('to_name', r.to_name), 2::smallint, 'ann:' || v_key || ':' || r.id::text) then
        queued := queued + 1;
      end if;
    end loop;
  end if;
  perform app.audit('announcement.send', 'announcements', v_key, jsonb_build_object('audience', v_kind, 'queued', queued, 'opted_out', skipped));
  return jsonb_build_object('queued', queued, 'opted_out', skipped, 'days', greatest(1, ceil(queued / 80.0))::integer);
end $$;
