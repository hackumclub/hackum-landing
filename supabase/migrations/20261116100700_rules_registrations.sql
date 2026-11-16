-- 8/12 rule functions: registrations, waitlist, teams, staff decisions (port of src/lib/mockdb/registrations.ts).
-- Locking order everywhere: events row first, then registrations/teams. The events row lock is what serialises capacity.

-- Detach one registration from its team: the team disappears with its last member, the captain passes to the oldest member.
create function app.detach_from_team(p_reg uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.event_registrations; t public.teams; heir uuid;
begin
  select * into r from public.event_registrations where id = p_reg;
  if not found or r.team_id is null then return; end if;
  update public.event_registrations set team_id = null where id = p_reg;
  select * into t from public.teams where id = r.team_id for update;
  if not found then return; end if;
  select x.profile_id into heir from public.event_registrations x
    where x.team_id = t.id and x.status <> 'cancelled' order by x.created_at, x.id limit 1;
  if heir is null then
    delete from public.teams where id = t.id;
  elsif t.captain_profile_id = r.profile_id then
    update public.teams set captain_profile_id = heir where id = t.id;
  end if;
end $$;

create function app.register_for_event(p_event_id uuid, p_answers jsonb default '{}', p_team jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; ev public.events; existing public.event_registrations; reg public.event_registrations;
  t public.teams; v_status public.reg_status; v_answers jsonb; v_mode text; v_name text; v_tpl public.notif_template;
  v_team_id uuid; v_code text; v_team_name text; v_found boolean;
begin
  me := app.require_profile(true);
  select * into ev from public.events where id = p_event_id for update;
  if not found or ev.status = 'draft' then perform app.fail('not_found'); end if;
  if ev.status <> 'published' then perform app.fail('closed'); end if;
  if ev.audience = 'invite' then perform app.fail('closed'); end if;
  if ev.audience = 'members' and me.status <> 'member' then perform app.fail('forbidden'); end if;
  if ev.audience = 'alumni' and me.status <> 'alumni' then perform app.fail('forbidden'); end if;
  if ev.school_scope = 'num' and me.school_id is distinct from 'num' then perform app.fail('ineligible'); end if;
  if (ev.reg_opens_at is not null and now() < ev.reg_opens_at)
     or (ev.reg_closes_at is not null and now() > ev.reg_closes_at) or now() > ev.ends_at then
    perform app.fail('closed');
  end if;

  select * into existing from public.event_registrations r where r.event_id = ev.id and r.profile_id = me.id for update;
  if found and existing.status in ('going', 'waitlisted', 'applied', 'attended') then
    return jsonb_build_object('status', existing.status, 'team_id', existing.team_id, 'invite_code', null);
  end if;
  v_found := found;
  if v_found and existing.status = 'rejected' then perform app.fail('conflict'); end if;

  v_answers := app.parse_answers(ev.questions, coalesce(p_answers, '{}'));

  -- Team step (application events with teams only).
  v_mode := p_team ->> 'mode';
  if ev.reg_mode = 'application' and ev.team_mode <> 'none' then
    if p_team is null or jsonb_typeof(p_team) <> 'object' or (v_mode = 'solo' and ev.team_mode = 'required') then
      if ev.team_mode = 'required' then perform app.fail('invalid'); end if;
      v_mode := null;
    elsif v_mode = 'create' then
      v_name := btrim(coalesce(p_team ->> 'name', ''));
      if length(v_name) < 2 or length(v_name) > 40 then perform app.fail('invalid'); end if;
      if exists (select 1 from public.teams x where x.event_id = ev.id and lower(x.name) = lower(v_name)) then perform app.fail('conflict'); end if;
    elsif v_mode = 'join' then
      if not app.team_code_allowed(me.id) then perform app.fail('rate_limited'); end if;
      select * into t from public.teams x where x.invite_code = app.normalize_invite_code(p_team ->> 'code') for update;
      if not found or t.event_id <> ev.id then
        -- A miss is recorded in this very call and RETURNED (a raised error would roll the failure row back). Nothing else was written yet.
        perform app.note_team_code_failure(me.id);
        return jsonb_build_object('ok', false, 'error', 'not_found');
      end if;
      if t.locked then perform app.fail('closed'); end if;
      if (select count(*) from public.event_registrations x where x.team_id = t.id and x.status <> 'cancelled') >= ev.team_size_max then
        perform app.fail('full');
      end if;
    elsif v_mode is distinct from 'solo' then
      perform app.fail('invalid');
    end if;
  else
    v_mode := null;
  end if;

  if ev.reg_mode = 'application' then
    v_status := 'applied';
  elsif ev.capacity is not null and app.going_count(ev.id) >= ev.capacity then
    if not ev.waitlist then perform app.fail('full'); end if;
    v_status := 'waitlisted';
  else
    v_status := 'going';
  end if;

  if v_found then
    update public.event_registrations set status = v_status, answers = v_answers, cancelled_at = null, created_at = now(),
      decided_by = null, decided_at = null, decision_notified_at = null
    where id = existing.id returning * into reg;
  else
    insert into public.event_registrations (event_id, profile_id, status, source, answers)
    values (ev.id, me.id, v_status, 'web', v_answers) returning * into reg;
  end if;

  if v_mode = 'create' then
    v_code := app.gen_invite_code();
    insert into public.teams (event_id, name, invite_code, captain_profile_id) values (ev.id, v_name, v_code, me.id) returning id into v_team_id;
    update public.event_registrations set team_id = v_team_id where id = reg.id;
    v_team_name := v_name;
  elsif v_mode = 'join' then
    v_team_id := t.id; v_code := t.invite_code; v_team_name := t.name;
    update public.event_registrations set team_id = t.id where id = reg.id;
  end if;

  v_tpl := (case v_status when 'applied' then 'application_received' when 'going' then 'rsvp_confirmed' else 'waitlist_notice' end)::public.notif_template;
  perform app.enqueue_notification(me.id, v_tpl,
    app.event_payload(ev, me) || case when v_team_id is not null then jsonb_build_object('team_name', v_team_name, 'invite_code', v_code) else '{}' end,
    0::smallint, v_tpl::text || ':' || ev.id::text || ':' || me.id::text || ':' || gen_random_uuid()::text);

  return jsonb_build_object('status', v_status, 'team_id', v_team_id, 'invite_code', v_code);
end $$;

create function app.cancel_registration(p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; ev public.events; reg public.event_registrations; nxt public.event_registrations; person public.profiles; had_seat boolean; got boolean;
begin
  me := app.require_profile();
  select * into ev from public.events where id = p_event_id for update;
  got := found;
  select * into reg from public.event_registrations r where r.event_id = p_event_id and r.profile_id = me.id for update;
  if not found or reg.status not in ('going', 'waitlisted', 'applied', 'attended') then perform app.fail('not_found'); end if;
  had_seat := reg.status = 'going';
  update public.event_registrations set status = 'cancelled', cancelled_at = now() where id = reg.id;
  perform app.detach_from_team(reg.id);
  if had_seat and got then
    -- Free seat: the oldest waitlisted person who still has an account moves up and is told.
    select r.* into nxt from public.event_registrations r
      join public.profiles p on p.id = r.profile_id and p.deleted_at is null
      where r.event_id = ev.id and r.status = 'waitlisted' order by r.created_at, r.id limit 1 for update of r;
    if found and (ev.capacity is null or app.going_count(ev.id) < ev.capacity) then
      update public.event_registrations set status = 'going' where id = nxt.id;
      select * into person from public.profiles where id = nxt.profile_id;
      perform app.enqueue_notification(person.id, 'waitlist_promoted', app.event_payload(ev, person), 0::smallint,
        'waitlist_promoted:' || ev.id::text || ':' || person.id::text || ':' || gen_random_uuid()::text);
    end if;
  end if;
end $$;

-- A registered applicant without a team starts one (the first application normally creates it inline).
create function app.create_team(p_event_id uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; ev public.events; reg public.event_registrations; v_name text := btrim(coalesce(p_name, '')); v_code text; v_id uuid;
begin
  me := app.require_profile(true);
  select * into ev from public.events where id = p_event_id for update;
  if not found then perform app.fail('not_found'); end if;
  select * into reg from public.event_registrations r where r.event_id = ev.id and r.profile_id = me.id
    and r.status in ('going', 'waitlisted', 'applied', 'attended') for update;
  if not found then perform app.fail('forbidden'); end if;
  if ev.reg_mode <> 'application' or ev.team_mode = 'none' then perform app.fail('invalid'); end if;
  if reg.team_id is not null then perform app.fail('conflict'); end if;
  if length(v_name) < 2 or length(v_name) > 40 then perform app.fail('invalid'); end if;
  if exists (select 1 from public.teams x where x.event_id = ev.id and lower(x.name) = lower(v_name)) then perform app.fail('conflict'); end if;
  v_code := app.gen_invite_code();
  insert into public.teams (event_id, name, invite_code, captain_profile_id) values (ev.id, v_name, v_code, me.id) returning id into v_id;
  update public.event_registrations set team_id = v_id where id = reg.id;
  return jsonb_build_object('team_id', v_id, 'invite_code', v_code);
end $$;

create function app.join_team(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; t public.teams; ev public.events; reg public.event_registrations;
begin
  me := app.require_profile(true);
  if not app.team_code_allowed(me.id) then perform app.fail('rate_limited'); end if;
  select * into t from public.teams x where x.invite_code = app.normalize_invite_code(p_code);
  if not found then
    perform app.note_team_code_failure(me.id);
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into ev from public.events where id = t.event_id for update;
  select * into t from public.teams where id = t.id for update;
  select * into reg from public.event_registrations r where r.event_id = t.event_id and r.profile_id = me.id
    and r.status in ('going', 'waitlisted', 'applied', 'attended') for update;
  if ev.id is null or reg.id is null then perform app.fail('forbidden'); end if;
  if reg.team_id is not null then perform app.fail('conflict'); end if;
  if t.locked then perform app.fail('closed'); end if;
  if (select count(*) from public.event_registrations x where x.team_id = t.id and x.status <> 'cancelled') >= ev.team_size_max then
    perform app.fail('full');
  end if;
  update public.event_registrations set team_id = t.id where id = reg.id;
  return jsonb_build_object('team_id', t.id);
end $$;

create function app.leave_team(p_team_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; reg public.event_registrations;
begin
  me := app.require_profile();
  select * into reg from public.event_registrations r where r.team_id = p_team_id and r.profile_id = me.id for update;
  if not found then perform app.fail('not_found'); end if;
  perform app.detach_from_team(reg.id);
end $$;

-- Names of the people on a team the caller belongs to (the team page). Names only, whatever their profile visibility.
create function app.team_roster(p_team_id uuid)
returns table (profile_id uuid, name public.l_text, is_captain boolean, reg_status public.reg_status, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (p_team_id in (select app.my_team_ids()) or app.is_staff()) then perform app.fail('forbidden'); end if;
  return query
    select r.profile_id, p.name, (t.captain_profile_id = r.profile_id), r.status, r.created_at
    from public.event_registrations r
    join public.teams t on t.id = r.team_id
    join public.profiles p on p.id = r.profile_id and p.deleted_at is null
    where r.team_id = p_team_id and r.status <> 'cancelled'
    order by r.created_at, r.id;
end $$;

create function app.decide_registrations(p_ids uuid[], p_decision text, p_scope text default 'individual') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  staff public.profiles; v_ids uuid[]; v_target public.reg_status; r public.event_registrations; ev public.events; person public.profiles;
  changed integer := 0; adding integer; was_waitlisted boolean; e uuid;
begin
  staff := app.require_staff();
  if p_decision not in ('accept', 'reject', 'waitlist') or coalesce(p_scope, 'individual') not in ('individual', 'team') then perform app.fail('invalid'); end if;
  perform 1 from public.events where id in (select x.event_id from public.event_registrations x where x.id = any (p_ids)) order by id for update;
  select array_agg(x.id) into v_ids from public.event_registrations x where x.id = any (p_ids);
  if v_ids is null then perform app.fail('not_found'); end if;
  if p_scope = 'team' then
    select array_agg(distinct y.id) into v_ids from public.event_registrations y
    where y.id = any (v_ids)
       or (y.team_id in (select z.team_id from public.event_registrations z where z.id = any (v_ids) and z.team_id is not null)
           and y.status in ('applied', 'waitlisted'));
  end if;
  select coalesce(array_agg(y.id), '{}') into v_ids from public.event_registrations y
    where y.id = any (v_ids) and y.status not in ('cancelled', 'attended', 'no_show');
  v_target := (case p_decision when 'accept' then 'going' when 'reject' then 'rejected' else 'waitlisted' end)::public.reg_status;

  if v_target = 'going' then
    for e in select distinct y.event_id from public.event_registrations y where y.id = any (v_ids) loop
      select * into ev from public.events where id = e;
      if ev.capacity is null then continue; end if;
      select count(*) into adding from public.event_registrations y where y.id = any (v_ids) and y.event_id = e and y.status <> 'going';
      if app.going_count(e) + adding > ev.capacity then perform app.fail('full'); end if;
    end loop;
  end if;

  for r in select * from public.event_registrations y where y.id = any (v_ids) order by y.created_at, y.id loop
    if r.status = v_target then continue; end if;
    perform app.audit('registration.decide', 'event_registrations', r.id::text, jsonb_build_object('status', jsonb_build_array(r.status, v_target)));
    was_waitlisted := r.status = 'waitlisted';
    update public.event_registrations set status = v_target, decided_by = staff.id, decided_at = now(), decision_notified_at = null where id = r.id;
    -- Plain RSVP events have no "send decisions" step: leaving the waitlist emails straight away, like the automatic promotion.
    select * into ev from public.events where id = r.event_id;
    select * into person from public.profiles where id = r.profile_id and deleted_at is null;
    if ev.id is not null and person.id is not null and ev.reg_mode = 'rsvp' and was_waitlisted and v_target = 'going' then
      update public.event_registrations set decision_notified_at = now() where id = r.id;
      perform app.enqueue_notification(person.id, 'waitlist_promoted', app.event_payload(ev, person), 0::smallint,
        'waitlist_promoted:' || ev.id::text || ':' || person.id::text || ':' || gen_random_uuid()::text);
    end if;
    changed := changed + 1;
  end loop;
  return jsonb_build_object('changed', changed);
end $$;

create function app.send_decisions(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ev public.events; r public.event_registrations; person public.profiles; tpl public.notif_template; v_team text; queued integer := 0;
begin
  perform app.require_staff();
  select * into ev from public.events where id = p_event_id for update;
  if not found then perform app.fail('not_found'); end if;
  for r in select * from public.event_registrations x where x.event_id = ev.id and x.decided_at is not null and x.decision_notified_at is null order by x.decided_at, x.id loop
    select * into person from public.profiles where id = r.profile_id and deleted_at is null;
    tpl := (case r.status when 'going' then 'application_accepted' when 'rejected' then 'application_rejected' when 'waitlisted' then 'waitlist_notice' end)::public.notif_template;
    update public.event_registrations set decision_notified_at = now() where id = r.id;
    if person.id is null or tpl is null then continue; end if;
    select t.name into v_team from public.teams t where t.id = r.team_id;
    if app.enqueue_notification(person.id, tpl, app.event_payload(ev, person) || jsonb_build_object('team_name', v_team), 0::smallint,
         'decision:' || ev.id::text || ':' || person.id::text || ':' || r.status::text || ':' || app.iso(r.decided_at)) then
      queued := queued + 1;
    end if;
  end loop;
  perform app.audit('decisions.send', 'events', ev.id::text, jsonb_build_object('queued', queued));
  return jsonb_build_object('queued', queued);
end $$;
