begin;
select plan(32);
select tests.use_issuer();

select tests.profile(h) from unnest(array['a', 'b', 'c', 'd']) h;
select tests.profile('other', 'guest', 'must', 'software');
select tests.staff('org', 'organizer');

select tests.event('hack', 5, 'published', '10 days', 'application', 'open', 'all', true,
  '[{"id":"skills","type":"short","label":{"mn":"Ур чадвар","en":"Skills"},"required":true}]'::jsonb, 'optional', 3);
select tests.event('req', 5, 'published', '10 days', 'application', 'open', 'all', true, '[]', 'required', 2);

-- create / join / leave -------------------------------------------------------------------------------------------------
select tests.as_person('a');
select app.register_for_event(tests.eid('hack'), '{"skills":"x"}', '{"mode":"create","name":"Team T"}');
select tests.as_person('b');
select app.register_for_event(tests.eid('hack'), '{"skills":"x"}', '{"mode":"solo"}');
select tests.as_owner();
select is(tests.val($$select team_id::text from public.event_registrations where event_id = tests.eid('hack') and profile_id = tests.pid('b')$$), null, 'solo applicants have no team');
select tests.as_person('b');
select is((select app.join_team(lower(tests.team_code('Team T'))) ->> 'team_id'), tests.val($$select id::text from public.teams where name = 'Team T'$$), 'a registered applicant joins a team with its code afterwards');
select throws_ok($$select app.join_team(tests.team_code('Team T'))$$, 'P0001', 'conflict', 'joining twice conflicts');
select tests.as_person('c');
select throws_ok($$select app.join_team(tests.team_code('Team T'))$$, 'P0001', 'forbidden', 'joining without a registration is forbidden');
select throws_ok($$select app.join_team('HK-NOPE')$$, 'P0001', 'not_found', 'unknown code is not_found');
select throws_ok($$select * from app.team_roster((select id from public.teams where name = 'Team T'))$$, 'P0001', 'forbidden', 'outsiders cannot read a team roster');
select tests.as_person('b');
select is((select count(*) from app.team_roster((select id from public.teams where name = 'Team T'))), 2::bigint, 'teammates read the roster (names only)');
select is((select count(*) from public.teams), 1::bigint, 'a member reads their own team row');
select tests.as_person('c');
select is((select count(*) from public.teams), 0::bigint, 'and an outsider does not');
select app.register_for_event(tests.eid('hack'), '{"skills":"x"}');
select is((select app.create_team(tests.eid('hack'), 'Team U') ->> 'invite_code') ~ '^HK-[A-Z0-9]{4}$', true, 'create_team gives a registered applicant a new team');
select throws_ok($$select app.create_team(tests.eid('hack'), 'Team V')$$, 'P0001', 'conflict', 'but only one');
select tests.as_person('d');
select app.register_for_event(tests.eid('hack'), '{"skills":"x"}', jsonb_build_object('mode', 'join', 'code', tests.team_code('Team T')));
select tests.as_owner();
update public.event_registrations set created_at = now() - interval '2 hours' where event_id = tests.eid('hack') and profile_id = tests.pid('b');
update public.event_registrations set created_at = now() - interval '1 hour' where event_id = tests.eid('hack') and profile_id = tests.pid('d');
select tests.as_person('a');
select app.leave_team(tests.val($$select id::text from public.teams where name = 'Team T'$$)::uuid);
select tests.as_owner();
select is(tests.val($$select p.handle from public.teams t join public.profiles p on p.id = t.captain_profile_id where t.name = 'Team T'$$), 'b', 'the captaincy passes to the oldest member when the captain leaves');
select tests.as_person('b'); select app.leave_team((select id from public.teams where name = 'Team T'));
select tests.as_person('d'); select app.leave_team((select id from public.teams where name = 'Team T'));
select tests.as_owner();
select is(tests.count($$select 1 from public.teams where name = 'Team T'$$), 0::bigint, 'the team is deleted when its last member leaves');
select tests.as_person('b');
select throws_ok($$select app.leave_team(gen_random_uuid())$$, 'P0001', 'not_found', 'leaving a team you are not on is not_found');
select tests.as_person('a');
select throws_ok($$select app.register_for_event(tests.eid('req'), '{}', '{"mode":"solo"}')$$, 'P0001', 'invalid', 'a required-team event refuses solo');

-- staff decisions -------------------------------------------------------------------------------------------------------
select tests.as_owner();
select tests.event('dec', 2, 'published', '10 days', 'application', 'open', 'all', true, '[]', 'optional', 2);
select tests.event('dec1', 1, 'published', '10 days', 'application');
select tests.as_person('a'); select app.register_for_event(tests.eid('dec'), '{}', '{"mode":"create","name":"Dec Team"}');
select tests.as_person('b'); select app.register_for_event(tests.eid('dec'), '{}', jsonb_build_object('mode', 'join', 'code', tests.team_code('Dec Team')));
select tests.as_person('c'); select app.register_for_event(tests.eid('dec'));
select tests.as_person('d'); select app.register_for_event(tests.eid('dec'));
select tests.as_person('a');
select throws_ok($$select app.decide_registrations(array[(select id from public.event_registrations where profile_id = tests.pid('a') and event_id = tests.eid('dec'))], 'accept')$$, 'P0001', 'forbidden', 'only staff decide');
select tests.as_person('org');
select throws_ok($$select app.decide_registrations(array[gen_random_uuid()], 'accept')$$, 'P0001', 'not_found', 'unknown ids are not_found');
select throws_ok($$select app.decide_registrations(array[(select id from public.event_registrations where profile_id = tests.pid('c') and event_id = tests.eid('dec'))], 'maybe')$$, 'P0001', 'invalid', 'an unknown decision is invalid');
select throws_ok($$select app.decide_registrations(array(select id from public.event_registrations where event_id = tests.eid('dec') and profile_id in (tests.pid('c'), tests.pid('d'), tests.pid('a'))), 'accept')$$, 'P0001', 'full', 'accepting more people than seats is refused');
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('dec') and status = 'going'$$), 0::bigint, 'and changes nothing');
select is((select app.decide_registrations(array[(select id from public.event_registrations where profile_id = tests.pid('a') and event_id = tests.eid('dec'))], 'accept', 'team') ->> 'changed'), '2', 'a whole team is decided at once');
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('dec') and status = 'going' and decided_by = tests.pid('org') and decided_at is not null and decision_notified_at is null$$), 2::bigint, 'recording who decided, and nothing mailed yet');
select is(tests.count($$select 1 from public.audit_log where action = 'registration.decide' and actor_profile_id = tests.pid('org')$$), 2::bigint, 'each decision is audited');
select is(tests.count($$select 1 from public.notifications where template = 'application_accepted'$$), 0::bigint, 'no decision mail before Send decisions');
select app.decide_registrations(array[(select id from public.event_registrations where profile_id = tests.pid('c') and event_id = tests.eid('dec'))], 'reject');
select app.decide_registrations(array[(select id from public.event_registrations where profile_id = tests.pid('d') and event_id = tests.eid('dec'))], 'waitlist');
select is((select app.send_decisions(tests.eid('dec')) ->> 'queued'), '4', 'Send decisions queues one mail per decision');
select is(tests.count($$select 1 from public.notifications where template in ('application_accepted', 'application_rejected', 'waitlist_notice') and payload ->> 'event_slug' = 'dec'$$), 4::bigint, 'accepted x2, rejected, waitlist notice');
select is((select app.send_decisions(tests.eid('dec')) ->> 'queued'), '0', 'and never twice');
select tests.as_person('c');
select throws_ok($$select app.send_decisions(tests.eid('dec'))$$, 'P0001', 'forbidden', 'only staff send decisions');
select tests.as_person('c'); 
select throws_ok($$select app.register_for_event(tests.eid('dec'))$$, 'P0001', 'conflict', 'a rejected applicant cannot simply apply again');

-- RSVP waitlist promoted by hand mails straight away ---------------------------------------------------------------------
select tests.as_owner();
select tests.event('wait-one', 1);
select tests.as_person('a'); select app.register_for_event(tests.eid('wait-one'));
select tests.as_person('c'); select app.register_for_event(tests.eid('wait-one'));
select tests.as_owner();
update public.events set capacity = 2 where slug = 'wait-one';
select tests.as_person('org');
select is((select app.decide_registrations(array[(select id from public.event_registrations where profile_id = tests.pid('c') and event_id = tests.eid('wait-one'))], 'accept') ->> 'changed'), '1', 'staff promote someone off an RSVP waitlist');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'waitlist_promoted' and profile_id = tests.pid('c')$$), 1::bigint, 'the person is mailed at once');
select is(tests.count($$select 1 from public.event_registrations where profile_id = tests.pid('c') and event_id = tests.eid('wait-one') and decision_notified_at is not null$$), 1::bigint, 'so nothing is left for Send decisions');

select * from finish();
rollback;
