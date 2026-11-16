begin;
select plan(46);
select tests.use_issuer();

select tests.profile(h) from unnest(array['a', 'b', 'c', 'd', 'e', 'f']) h;
select tests.profile('fresh', 'guest', 'num', 'software', false);
select tests.profile('mem', 'member');
select tests.profile('other', 'guest', 'must', 'software');
select tests.staff('org', 'organizer');

-- RSVP -----------------------------------------------------------------------------------------------------------------
select tests.event('rsvp1');
select tests.as_person('a');
select is((select app.register_for_event(tests.eid('rsvp1')) ->> 'status'), 'going', 'a guest is seated');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'rsvp_confirmed' and profile_id = tests.pid('a')$$), 1::bigint, 'exactly one confirmation email is queued');
select is(tests.val($$select payload ->> 'event_slug' || ':' || (payload ->> 'ics_sequence') from public.notifications where template = 'rsvp_confirmed'$$), 'rsvp1:0', 'payload carries slug and ics_sequence');
select is(tests.count($$select 1 from public.inbox where kind = 'rsvp_confirmed' and profile_id = tests.pid('a')$$), 1::bigint, 'and an inbox row');
select tests.as_person('a');
select is((select app.register_for_event(tests.eid('rsvp1')) ->> 'status'), 'going', 'registering again is idempotent');
select tests.as_owner();
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('rsvp1')$$), 1::bigint, 'still one registration');
select is(tests.count($$select 1 from public.notifications where template = 'rsvp_confirmed'$$), 1::bigint, 'and no second email');

-- waitlist / full ------------------------------------------------------------------------------------------------------
select tests.event('cap2', 2);
select tests.as_person('a'); select app.register_for_event(tests.eid('cap2'));
select tests.as_person('b'); select app.register_for_event(tests.eid('cap2'));
select tests.as_person('c');
select is((select app.register_for_event(tests.eid('cap2')) ->> 'status'), 'waitlisted', 'the third person is waitlisted when the event allows it');
select tests.as_owner();
select tests.event('nowl', 1, 'published', '10 days', 'rsvp', 'open', 'all', false);
select tests.as_person('a'); select app.register_for_event(tests.eid('nowl'));
select tests.as_person('b');
select throws_ok($$select app.register_for_event(tests.eid('nowl'))$$, 'P0001', 'full', 'full without a waitlist reports full');
select tests.as_owner();
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('nowl') and profile_id = tests.pid('b')$$), 0::bigint, 'and creates nothing');

-- capacity simulation: six people, three seats -------------------------------------------------------------------------
select tests.event('race3', 3);
select tests.as_person(h) , app.register_for_event(tests.eid('race3')) from unnest(array['a', 'b', 'c', 'd', 'e', 'f']) h;
select tests.as_owner();
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('race3') and status = 'going'$$), 3::bigint, 'six registrations never seat more than capacity');
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('race3') and status = 'waitlisted'$$), 3::bigint, 'the rest are waitlisted');
select ok((select prosrc from pg_proc where oid = 'app.register_for_event(uuid, jsonb, jsonb)'::regprocedure) ~* 'from public\.events where id = p_event_id for update',
  'register_for_event locks the event row before counting seats (concurrent callers serialise)');
select ok((select prosrc from pg_proc where oid = 'app.cancel_registration(uuid)'::regprocedure) ~* 'from public\.events where id = p_event_id for update', 'cancel_registration takes the same lock');
select ok((select prosrc from pg_proc where oid = 'app.decide_registrations(uuid[], text, text)'::regprocedure) ~* 'from public\.events where id in .* for update', 'decide_registrations locks the events involved');

-- waitlist promotion on cancel -----------------------------------------------------------------------------------------
select tests.event('promo', 1);
select tests.as_person('a'); select app.register_for_event(tests.eid('promo'));
select tests.as_person('b'); select app.register_for_event(tests.eid('promo'));
select tests.as_person('c'); select app.register_for_event(tests.eid('promo'));
select tests.as_owner();
update public.event_registrations set created_at = now() - interval '2 hours' where event_id = tests.eid('promo') and profile_id = tests.pid('b');
update public.event_registrations set created_at = now() - interval '1 hour' where event_id = tests.eid('promo') and profile_id = tests.pid('c');
select tests.as_person('a'); select app.cancel_registration(tests.eid('promo'));
select tests.as_owner();
select is(tests.val($$select status::text from public.event_registrations where event_id = tests.eid('promo') and profile_id = tests.pid('a')$$), 'cancelled', 'cancelling marks the registration cancelled');
select is(tests.val($$select status::text from public.event_registrations where event_id = tests.eid('promo') and profile_id = tests.pid('b')$$), 'going', 'the oldest waitlisted person is promoted');
select is(tests.val($$select status::text from public.event_registrations where event_id = tests.eid('promo') and profile_id = tests.pid('c')$$), 'waitlisted', 'the next one keeps waiting');
select is(tests.count($$select 1 from public.notifications where template = 'waitlist_promoted' and profile_id = tests.pid('b')$$), 1::bigint, 'the promoted person is emailed');
select tests.as_person('a');
select is((select app.register_for_event(tests.eid('promo')) ->> 'status'), 'waitlisted', 'a cancelled person can register again (to the waitlist now)');
select throws_ok($$select app.cancel_registration(gen_random_uuid())$$, 'P0001', 'not_found', 'cancelling an unknown registration is not_found');

-- who can register and when ---------------------------------------------------------------------------------------------
select tests.as_anon();
select throws_ok($$select app.register_for_event(tests.eid('rsvp1'))$$, '42501', null, 'anonymous visitors cannot call the function');
select tests.as_person('fresh');
select throws_ok($$select app.register_for_event(tests.eid('rsvp1'))$$, 'P0001', 'forbidden', 'a person who has not finished onboarding is forbidden');
select tests.as_owner();
select tests.event('invite', null, 'published', '10 days', 'rsvp', 'invite');
select tests.event('closedreg', null);
update public.events set starts_at = now() + interval '3 days', ends_at = now() + interval '3 days 2 hours', reg_closes_at = now() - interval '1 hour' where slug = 'closedreg';
select tests.event('notyet', null);
update public.events set reg_opens_at = now() + interval '1 day' where slug = 'notyet';
select tests.event('over', null, 'published', '-5 hours');
select tests.event('cancelled1', null, 'cancelled'); select tests.event('draft1', null, 'draft');
select tests.event('memonly', null, 'published', '10 days', 'rsvp', 'members'); select tests.event('numonly', null, 'published', '10 days', 'rsvp', 'open', 'num');
select tests.as_person('a');
select throws_ok($$select app.register_for_event(tests.eid('invite'))$$, 'P0001', 'closed', 'invite-only is closed');
select throws_ok($$select app.register_for_event(tests.eid('closedreg'))$$, 'P0001', 'closed', 'closed after registration closed');
select throws_ok($$select app.register_for_event(tests.eid('notyet'))$$, 'P0001', 'closed', 'closed before registration opens');
select throws_ok($$select app.register_for_event(tests.eid('over'))$$, 'P0001', 'closed', 'closed after the event ended');
select throws_ok($$select app.register_for_event(tests.eid('cancelled1'))$$, 'P0001', 'closed', 'closed when cancelled');
select throws_ok($$select app.register_for_event(tests.eid('draft1'))$$, 'P0001', 'not_found', 'drafts are hidden completely');
select throws_ok($$select app.register_for_event(tests.eid('memonly'))$$, 'P0001', 'forbidden', 'members-only events refuse guests');
select tests.as_person('mem');
select is((select app.register_for_event(tests.eid('memonly')) ->> 'status'), 'going', 'but seat members');
select tests.as_person('other');
select throws_ok($$select app.register_for_event(tests.eid('numonly'))$$, 'P0001', 'ineligible', 'a NUM-only event refuses another school');
select tests.as_person('a');
select is((select app.register_for_event(tests.eid('numonly')) ->> 'status'), 'going', 'and seats a NUM student');

-- hackathon applications & teams ----------------------------------------------------------------------------------------
select tests.as_owner();
select tests.event('hack', 2, 'published', '10 days', 'application', 'open', 'all', true,
  '[{"id":"skills","type":"short","label":{"mn":"Ур чадвар","en":"Skills"},"required":true},{"id":"github","type":"url","label":{"mn":"GitHub","en":"GitHub"},"required":false}]'::jsonb, 'optional', 2);
select tests.as_person('a');
select throws_ok($$select app.register_for_event(tests.eid('hack'), '{"github":"https://github.com/x"}')$$, 'P0001', 'invalid', 'a missing required answer is invalid');
select throws_ok($$select app.register_for_event(tests.eid('hack'), '{"skills":"x","github":"javascript:alert(1)"}')$$, 'P0001', 'invalid', 'a non-http url answer is invalid');
select is((select app.register_for_event(tests.eid('hack'), '{"skills":"React","extra":"dropped"}', '{"mode":"create","name":"Нүүдэлчид"}') ->> 'status'), 'applied', 'an application is recorded as applied');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'application_received'$$), 1::bigint, 'with the received email, not an RSVP confirmation');
select is(tests.count($$select 1 from public.notifications where template = 'rsvp_confirmed' and payload ->> 'event_slug' = 'hack'$$), 0::bigint, 'no RSVP confirmation');
select is(tests.val($$select (answers ? 'extra')::text from public.event_registrations where event_id = tests.eid('hack') and profile_id = tests.pid('a')$$), 'false', 'unknown answer keys are dropped');
select ok(tests.team_code('Нүүдэлчид') ~ '^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'the team has an HK-XXXX-XXXX-XXXX invite code');
select tests.as_person('b');
select is((select app.register_for_event(tests.eid('hack'), '{"skills":"y"}', jsonb_build_object('mode', 'join', 'code', lower(tests.team_code('Нүүдэлчид')))) ->> 'status'), 'applied', 'a second person joins with the code (any case)');
select tests.as_person('c');
select throws_ok($$select app.register_for_event(tests.eid('hack'), '{"skills":"z"}', jsonb_build_object('mode', 'join', 'code', tests.team_code('Нүүдэлчид')))$$, 'P0001', 'full', 'a third member is over the size limit');
select throws_ok($$select app.register_for_event(tests.eid('hack'), '{"skills":"z"}', '{"mode":"create","name":"T"}')$$, 'P0001', 'invalid', 'a one-letter team name is invalid');
select throws_ok($$select app.register_for_event(tests.eid('hack'), '{"skills":"z"}', '{"mode":"join","code":"HK-ZZZZ"}')$$, 'P0001', 'not_found', 'an unknown code is not_found');
select throws_ok($$select app.register_for_event(tests.eid('hack'), '{"skills":"z"}', '{"mode":"create","name":"нүүдэлчид"}')$$, 'P0001', 'conflict', 'a duplicate team name (any case) conflicts');
select tests.as_owner();
select is(tests.count($$select 1 from public.event_registrations where event_id = tests.eid('hack') and profile_id = tests.pid('c')$$), 0::bigint, 'failures create no registration');

select * from finish();
rollback;
