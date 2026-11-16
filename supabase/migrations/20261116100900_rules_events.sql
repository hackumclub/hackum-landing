-- 10/12 rule functions: events (port of src/lib/mockdb/events.ts).

-- Validated copy of what an organizer edits. Raises 'invalid'. Keys outside the editable list (id, status, ics_sequence, ...) are ignored.
create function app.event_from_input(p jsonb) returns public.events
language plpgsql stable set search_path = '' as $$
declare
  keys constant text[] := array['slug','kind','title','tagline','description','starts_at','ends_at','mode','venue_name','venue_address',
    'audience','school_scope','capacity','waitlist','reg_opens_at','reg_closes_at','cover_path','poster_path','themes','external_url',
    'reg_mode','questions','team_mode','team_size_min','team_size_max','decision_deadline'];
  picked jsonb; r public.events; v_url text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform app.fail('invalid'); end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}') into picked from jsonb_each(p) e where e.key = any (keys);
  begin
    r := jsonb_populate_record(null::public.events, picked);
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range
                 or invalid_parameter_value or check_violation or not_null_violation or string_data_right_truncation or datatype_mismatch then
    perform app.fail('invalid');
  end;
  r.tagline := coalesce(r.tagline, '{"mn":"","en":""}');
  r.description := coalesce(r.description, '{"mn":"","en":""}');
  r.mode := coalesce(r.mode, 'offline');
  r.audience := coalesce(r.audience, 'open');
  r.school_scope := coalesce(r.school_scope, 'all');
  r.waitlist := coalesce(r.waitlist, true);
  r.themes := coalesce(r.themes, '{}');
  r.reg_mode := coalesce(r.reg_mode, 'rsvp');
  r.questions := coalesce(r.questions, '[]');
  r.team_mode := coalesce(r.team_mode, 'none');
  r.team_size_min := coalesce(r.team_size_min, 1);
  r.team_size_max := coalesce(r.team_size_max, 1);
  v_url := nullif(btrim(coalesce(p ->> 'online_url', '')), '');

  if r.slug is null or r.slug !~ '^[a-z0-9-]{3,60}$' or r.title is null or btrim(r.title ->> 'mn') = '' or r.kind is null then perform app.fail('invalid'); end if;
  if r.starts_at is null or r.ends_at is null or r.ends_at <= r.starts_at then perform app.fail('invalid'); end if;
  if r.capacity is not null and (r.capacity < 1 or r.capacity > 5000) then perform app.fail('invalid'); end if;
  if r.reg_closes_at is not null and r.reg_closes_at > r.starts_at then perform app.fail('invalid'); end if;
  if r.reg_opens_at is not null and r.reg_closes_at is not null and r.reg_opens_at > r.reg_closes_at then perform app.fail('invalid'); end if;
  if r.reg_mode = 'application' and r.decision_deadline is null then perform app.fail('invalid'); end if;
  if r.team_mode <> 'none' and not (r.team_size_min >= 1 and r.team_size_min <= r.team_size_max and r.team_size_max <= 10) then perform app.fail('invalid'); end if;
  if r.mode <> 'offline' and (v_url is null or v_url !~ '^https://') then perform app.fail('invalid'); end if;
  if not app.valid_questions(r.questions) then perform app.fail('invalid'); end if;
  return r;
end $$;

create function app.event_online_url_from_input(p jsonb, p_mode public.event_mode) returns text
language sql immutable set search_path = '' as $$
  select case when p_mode = 'offline' then null else nullif(btrim(coalesce(p ->> 'online_url', '')), '') end
$$;

-- Changing any of these tells people with a seat (and bumps the calendar invite sequence).
create function app.event_notify_changes(ev public.events, nu public.events, p_old_url text, p_new_url text) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_remove(array[
    case when ev.starts_at is distinct from nu.starts_at then 'starts_at' end,
    case when ev.ends_at is distinct from nu.ends_at then 'ends_at' end,
    case when ev.mode is distinct from nu.mode then 'mode' end,
    case when ev.venue_name is distinct from nu.venue_name then 'venue_name' end,
    case when ev.venue_address is distinct from nu.venue_address then 'venue_address' end,
    case when p_old_url is distinct from p_new_url then 'online_url' end
  ], null), '{}')
$$;

create function app.skip_queued_reminders(p_event uuid, p_only_not_starting_at timestamptz default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications n set status = 'skipped'
  where n.status = 'queued' and n.template = 'reminder_24h' and n.payload ->> 'event_id' = p_event::text
    and (p_only_not_starting_at is null or n.payload ->> 'starts_at' is distinct from app.iso(p_only_not_starting_at))
$$;

create function app.create_event(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare staff public.profiles; r public.events; v_id uuid; v_url text;
begin
  staff := app.require_staff();
  r := app.event_from_input(p_input);
  v_url := app.event_online_url_from_input(p_input, r.mode);
  if exists (select 1 from public.events e where e.slug = r.slug) then perform app.fail('conflict'); end if;
  begin
    insert into public.events (slug, kind, title, tagline, description, starts_at, ends_at, mode, venue_name, venue_address, audience, school_scope,
      capacity, waitlist, reg_opens_at, reg_closes_at, status, cover_path, poster_path, themes, external_url, reg_mode, questions, team_mode,
      team_size_min, team_size_max, decision_deadline, created_by)
    values (r.slug, r.kind, r.title, r.tagline, r.description, r.starts_at, r.ends_at, r.mode, r.venue_name, r.venue_address, r.audience, r.school_scope,
      r.capacity, r.waitlist, r.reg_opens_at, r.reg_closes_at, 'draft', r.cover_path, r.poster_path, r.themes, r.external_url, r.reg_mode, r.questions, r.team_mode,
      r.team_size_min, r.team_size_max, r.decision_deadline, staff.id)
    returning id into v_id;
  exception when unique_violation then perform app.fail('conflict');
            when check_violation then perform app.fail('invalid');
  end;
  if v_url is not null then insert into public.event_online_links (event_id, online_url) values (v_id, v_url); end if;
  perform app.audit('event.create', 'events', v_id::text, jsonb_build_object('slug', r.slug));
  return jsonb_build_object('id', v_id);
end $$;

-- What a change would do before it is committed (the staged-edit dialog): changed notify fields, people told, non-NUM seats.
create function app.preview_event_change(p_id uuid, p_input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ev public.events; nu public.events; v_old text; v_new text; changed text[]; seated integer; non_num integer := 0;
begin
  perform app.require_staff();
  select * into ev from public.events where id = p_id;
  if not found then perform app.fail('not_found'); end if;
  nu := app.event_from_input(p_input);
  v_old := (select l.online_url from public.event_online_links l where l.event_id = p_id);
  v_new := app.event_online_url_from_input(p_input, nu.mode);
  changed := app.event_notify_changes(ev, nu, v_old, v_new);
  select count(*) into seated from public.event_registrations r join public.profiles p on p.id = r.profile_id and p.deleted_at is null
    where r.event_id = p_id and r.status = 'going';
  -- Narrowing to NUM keeps existing seats (nobody is silently dropped) but staff should see how many are from other schools.
  if nu.school_scope = 'num' and ev.school_scope <> 'num' then
    select count(*) into non_num from public.event_registrations r join public.profiles p on p.id = r.profile_id and p.deleted_at is null
      where r.event_id = p_id and r.status = 'going' and p.school_id is distinct from 'num';
  end if;
  return jsonb_build_object('changed', to_jsonb(changed),
    'will_notify', case when ev.status = 'published' and cardinality(changed) > 0 then seated else 0 end, 'non_num_registrants', non_num);
end $$;

create function app.update_event(p_id uuid, p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events; nu public.events; fresh public.events; v_old text; v_new text; changed text[]; diff jsonb := '{}'::jsonb;
  k text; ov jsonb; nv jsonb; notified integer := 0; r record; person public.profiles;
  editable constant text[] := array['slug','kind','title','tagline','description','starts_at','ends_at','mode','venue_name','venue_address','online_url',
    'audience','school_scope','capacity','waitlist','reg_opens_at','reg_closes_at','cover_path','poster_path','themes','external_url','reg_mode',
    'questions','team_mode','team_size_min','team_size_max','decision_deadline'];
begin
  perform app.require_staff();
  select * into ev from public.events where id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  nu := app.event_from_input(p_input);
  if exists (select 1 from public.events e where e.slug = nu.slug and e.id <> p_id) then perform app.fail('conflict'); end if;
  v_old := (select l.online_url from public.event_online_links l where l.event_id = p_id);
  v_new := app.event_online_url_from_input(p_input, nu.mode);
  changed := app.event_notify_changes(ev, nu, v_old, v_new);

  ov := to_jsonb(ev) || jsonb_build_object('online_url', v_old);
  nv := to_jsonb(nu) || jsonb_build_object('online_url', v_new);
  foreach k in array editable loop
    if ov -> k is distinct from nv -> k then diff := diff || jsonb_build_object(k, jsonb_build_array(ov -> k, nv -> k)); end if;
  end loop;

  begin
    update public.events set slug = nu.slug, kind = nu.kind, title = nu.title, tagline = nu.tagline, description = nu.description,
      starts_at = nu.starts_at, ends_at = nu.ends_at, mode = nu.mode, venue_name = nu.venue_name, venue_address = nu.venue_address,
      audience = nu.audience, school_scope = nu.school_scope, capacity = nu.capacity, waitlist = nu.waitlist, reg_opens_at = nu.reg_opens_at,
      reg_closes_at = nu.reg_closes_at, cover_path = nu.cover_path, poster_path = nu.poster_path, themes = nu.themes, external_url = nu.external_url,
      reg_mode = nu.reg_mode, questions = nu.questions, team_mode = nu.team_mode, team_size_min = nu.team_size_min, team_size_max = nu.team_size_max,
      decision_deadline = nu.decision_deadline
    where id = p_id;
  exception when unique_violation then perform app.fail('conflict');
            when check_violation then perform app.fail('invalid');
  end;
  if v_new is null then delete from public.event_online_links where event_id = p_id;
  else insert into public.event_online_links (event_id, online_url) values (p_id, v_new) on conflict (event_id) do update set online_url = excluded.online_url;
  end if;
  if diff <> '{}' then perform app.audit('event.update', 'events', p_id::text, diff); end if;

  if ev.starts_at is distinct from nu.starts_at then perform app.skip_queued_reminders(p_id, nu.starts_at); end if;
  if ev.status = 'published' and cardinality(changed) > 0 then
    update public.events set ics_sequence = ics_sequence + 1 where id = p_id returning * into fresh;
    for r in select reg.profile_id from public.event_registrations reg where reg.event_id = p_id and reg.status = 'going' order by reg.created_at, reg.id loop
      select * into person from public.profiles where id = r.profile_id and deleted_at is null;
      if person.id is null then continue; end if;
      if app.enqueue_notification(person.id, 'event_updated', app.event_payload(fresh, person) || jsonb_build_object('changed', array_to_string(changed, ',')),
           0::smallint, 'event_updated:' || p_id::text || ':' || person.id::text || ':' || fresh.ics_sequence::text) then
        notified := notified + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('notified', notified);
end $$;

create function app.set_event_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.events; v_status public.event_status; r record; person public.profiles; allowed boolean;
begin
  perform app.require_staff();
  begin v_status := p_status::public.event_status; exception when invalid_text_representation or null_value_not_allowed then perform app.fail('invalid'); end;
  select * into ev from public.events where id = p_id for update;
  if not found then perform app.fail('not_found'); end if;
  allowed := case ev.status
    when 'draft' then v_status = 'published'
    when 'published' then v_status in ('draft', 'cancelled', 'completed')
    when 'cancelled' then v_status = 'archived'
    when 'completed' then v_status = 'archived'
    else false end;
  if not allowed then perform app.fail('conflict'); end if;
  if v_status = 'draft' and exists (select 1 from public.event_registrations x where x.event_id = p_id and x.status in ('going', 'waitlisted', 'applied')) then
    perform app.fail('conflict');
  end if;
  update public.events set status = v_status where id = p_id;
  if v_status = 'cancelled' then
    perform app.skip_queued_reminders(p_id);
    for r in select x.profile_id from public.event_registrations x where x.event_id = p_id and x.status in ('going', 'waitlisted', 'applied') order by x.created_at, x.id loop
      select * into person from public.profiles where id = r.profile_id and deleted_at is null;
      if person.id is not null then
        perform app.enqueue_notification(person.id, 'event_cancelled', app.event_payload(ev, person), 0::smallint, 'event_cancelled:' || p_id::text || ':' || person.id::text);
      end if;
    end loop;
  end if;
  perform app.audit('event.status', 'events', p_id::text, jsonb_build_object('status', jsonb_build_array(ev.status, v_status)));
end $$;

-- ── cron jobs (called by pg_cron as the database owner, no JWT) ─────────────────────────────────────────────────────

-- Queue reminder_24h for everyone going to a published event that starts 23-25h from now. Idempotent per start time.
create function app.enqueue_due_reminders(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare ev public.events; r record; p public.profiles; queued integer := 0;
begin
  for ev in select * from public.events e where e.status = 'published' and e.starts_at > p_now + interval '23 hours' and e.starts_at <= p_now + interval '25 hours' loop
    for r in select x.profile_id from public.event_registrations x where x.event_id = ev.id and x.status = 'going' loop
      select * into p from public.profiles where id = r.profile_id and deleted_at is null;
      if p.id is not null and app.enqueue_notification(p.id, 'reminder_24h', app.event_payload(ev, p), 1::smallint,
           'reminder24:' || ev.id::text || ':' || p.id::text || ':' || floor(extract(epoch from ev.starts_at))::bigint::text, p_now) then
        queued := queued + 1;
      end if;
    end loop;
  end loop;
  return queued;
end $$;
