begin;
select plan(68);
select tests.use_issuer();

select tests.profile(h) from unnest(array['p1', 'p2', 'p3', 'viewer', 'seated']) h;
select tests.profile('mem', 'member'); select tests.profile('alum', 'alumni');
select tests.staff('org', 'organizer'); select tests.staff('adm', 'admin');

-- 1. invite codes -------------------------------------------------------------------------------------------------------
select ok(app.gen_invite_code() ~ '^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'a new invite code is HK-XXXX-XXXX-XXXX from the 32-character alphabet');
select is((select count(distinct app.gen_invite_code()) from generate_series(1, 200)), 200::bigint, '200 generated codes are distinct');
select is(app.normalize_invite_code(i), o, 'normalises ' || d)
from (values
  ('hk-abcd-efgh-jkmn', 'HK-ABCD-EFGH-JKMN', 'lowercase'), ('  hk abcd efgh jkmn ', 'HK-ABCD-EFGH-JKMN', 'spaces'),
  ('HKABCDEFGHJKMN', 'HK-ABCD-EFGH-JKMN', 'missing dashes'), ('HK-ABCD-EFGH-JKMN', 'HK-ABCD-EFGH-JKMN', 'an already canonical code'),
  ('hk_abcd.efgh/jkmn', 'HK-ABCD-EFGH-JKMN', 'other separators'),
  ('hk-ab12', 'HK-AB12', 'a legacy code'), ('HKAB12', 'HK-AB12', 'a legacy code without the dash'),
  ('  nope!! ', 'NOPE!!', 'anything else (uppercased, trimmed)'), ('', '', 'an empty string')
) v(i, o, d);
select ok(not has_function_privilege('authenticated', 'app.gen_invite_code()', 'execute') and not has_function_privilege('authenticated', 'app.team_code_allowed(uuid)', 'execute')
  and not has_function_privilege('anon', 'app.normalize_invite_code(text)', 'execute'), 'code generation and the throttle check are internal');
select ok(has_function_privilege('authenticated', 'app.note_team_code_failure()', 'execute') and not has_function_privilege('anon', 'app.note_team_code_failure()', 'execute'), 'only signed-in people can note a failed guess');
select ok(not has_table_privilege('authenticated', 'app.team_code_failures', 'select') and not has_table_privilege('anon', 'app.team_code_failures', 'insert')
  and (select relrowsecurity from pg_class where oid = 'app.team_code_failures'::regclass), 'the failure log is private with RLS on');

select tests.event('hackx', 20, 'published', '10 days', 'application', 'open', 'all', true, '[]', 'optional', 3);
select tests.as_person('p1');
select ok((select app.register_for_event(tests.eid('hackx'), '{}', '{"mode":"create","name":"Alpha"}') ->> 'invite_code') ~ '^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'a created team gets the new format');
select tests.as_owner();
insert into public.teams (event_id, name, invite_code, captain_profile_id) values (tests.eid('hackx'), 'Legacy', 'HK-AB12', tests.pid('p1'));
select tests.as_person('p2');
select is((select app.register_for_event(tests.eid('hackx'), '{}', jsonb_build_object('mode', 'join', 'code', lower(replace(tests.team_code('Alpha'), '-', ' ')))) ->> 'status'), 'applied', 'joining accepts lowercase and spaces (register_for_event)');
select tests.as_person('p3');
select is((select app.register_for_event(tests.eid('hackx'), '{}') ->> 'status'), 'applied', 'p3 registers solo');
select is((select app.join_team(replace(lower(tests.team_code('Alpha')), '-', ''))) ->> 'team_id', tests.val($$select id::text from public.teams where name = 'Alpha'$$), 'join_team accepts a code with no dashes');
select tests.as_person('viewer');
select app.register_for_event(tests.eid('hackx'), '{}');
select is((select app.join_team('hk ab12') ->> 'team_id'), tests.val($$select id::text from public.teams where name = 'Legacy'$$), 'a legacy HK-XXXX demo code still works');

-- throttle: 10 noted failures in an hour
select tests.as_person('mem');
select app.register_for_event(tests.eid('hackx'), '{}');
select throws_ok($$select app.join_team('HK-NOPE-NOPE-NOPE')$$, 'P0001', 'not_found', 'a wrong code is not_found');
select app.note_team_code_failure() from generate_series(1, 9);
select throws_ok($$select app.join_team('HK-NOPE-NOPE-NOPE')$$, 'P0001', 'not_found', 'still not_found after 9 noted failures');
select app.note_team_code_failure();
select throws_ok($$select app.join_team('HK-NOPE-NOPE-NOPE')$$, 'P0001', 'rate_limited', 'rate_limited from the 10th noted failure on');
select tests.as_person('seated');
select app.note_team_code_failure() from generate_series(1, 10);
select throws_ok(format($f$select app.register_for_event(tests.eid('hackx'), '{}', jsonb_build_object('mode', 'join', 'code', %L))$f$, tests.team_code('Alpha')), 'P0001', 'rate_limited', 'the register_for_event join branch is throttled too, even with a right code');
select tests.as_person('alum');
select app.register_for_event(tests.eid('hackx'), '{}');
select throws_ok($$select app.join_team('HK-NOPE-NOPE-NOPE')$$, 'P0001', 'not_found', 'a different person is unaffected');
select tests.as_anon();
select throws_ok($$select app.note_team_code_failure()$$, '42501', null, 'anon cannot call note_team_code_failure');
select tests.as_owner();
select is(tests.count($$select 1 from app.team_code_failures where profile_id = tests.pid('mem')$$), 10::bigint, 'ten failures were recorded for the guesser');
update app.team_code_failures set at = now() - interval '2 hours' where profile_id = tests.pid('mem');
select tests.as_person('mem');
select throws_ok($$select app.join_team('HK-NOPE-NOPE-NOPE')$$, 'P0001', 'not_found', 'old failures stop counting after an hour');

-- 2. notification preferences ---------------------------------------------------------------------------------------------
select tests.as_person('p1');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update') and not has_column_privilege('authenticated', 'public.profiles', 'notif_prefs', 'update'), 'profiles have no direct update privilege at all');
select throws_ok($$update public.profiles set notif_prefs = '{"reminders":true,"updates":true,"announcements":"x"}' where id = tests.pid('p1')$$, '42501', null, 'a direct notif_prefs update is refused');
select throws_ok($$update public.profiles set name = '{"mn":"Hack","en":""}' where id = tests.pid('p1')$$, '42501', null, 'so is a direct name update');
select throws_ok($$update public.profiles set school_id = 'num' where id = tests.pid('p1')$$, '42501', null, 'and school_id');
select throws_ok($$select app.update_prefs('{"reminders":true,"updates":true,"announcements":"x"}', 'mn', 'members')$$, 'P0001', 'invalid', 'the RPC rejects a non-boolean value');
select throws_ok($$select app.update_prefs('{"reminders":true,"updates":true,"announcements":"false"}', 'mn', 'members')$$, 'P0001', 'invalid', 'including the string "false"');
select lives_ok($$select app.update_prefs('{"reminders":true,"updates":false,"announcements":true,"evil":1}', 'mn', 'members')$$, 'extra keys in the input are ignored');
select tests.as_owner();
select is(tests.val($$select notif_prefs::text from public.profiles where handle = 'p1'$$), '{"updates": false, "reminders": true, "announcements": true}', 'only the three boolean keys are stored');
select throws_ok($$update public.profiles set notif_prefs = '{"reminders":true,"updates":true,"announcements":"x"}' where handle = 'p1'$$, '23514', null, 'even the table owner cannot store a non-boolean (CHECK)');
select throws_ok($$update public.profiles set notif_prefs = '{"reminders":true,"updates":true,"announcements":true,"extra":1}' where handle = 'p1'$$, '23514', null, 'or an extra key');
select throws_ok($$update public.profiles set notif_prefs = '{"reminders":true,"updates":true}' where handle = 'p1'$$, '23514', null, 'or a missing one');
update public.profiles set notif_prefs = '{"reminders":true,"updates":true,"announcements":false}' where handle = 'p2';
select tests.as_person('org');
select is((select app.send_announcement('hard1', '{"kind":"everyone"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}') ->> 'opted_out'), '1', 'announcements keep working and honour the one opt-out');
select tests.as_service();
select is(app.enqueue_notification(tests.pid('p2'), 'announcement', '{}', 2::smallint, 'hard-n1'), true, 'enqueue_notification works with the prefs as jsonb booleans');
select tests.as_owner();
select is(tests.count($$select 1 from public.inbox where dedupe_key = 'hard-n1'$$), 0::bigint, 'and skips the in-app item for the opted-out person');

-- 3. no status oracle -------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname in ('poll_eligible', 'profile_visible', 'poll_is_anonymous')), 0::bigint, 'the id-taking helpers are gone');
select ok(has_function_privilege('authenticated', 'app.poll_eligible_me(public.poll_audience)', 'execute') and has_function_privilege('anon', 'app.poll_eligible_me(public.poll_audience)', 'execute'), 'the policy helper only looks at the caller');
select ok(not has_function_privilege('authenticated', 'app.poll_eligible_for(public.poll_audience, uuid)', 'execute') and not has_function_privilege('anon', 'app.poll_eligible_for(public.poll_audience, uuid)', 'execute'), 'the id-taking variant is internal');
select tests.as_anon();
select throws_ok($$select app.poll_eligible_for('members', gen_random_uuid())$$, '42501', null, 'anon cannot probe a profile''s status');
select throws_ok($$select app.poll_eligible('members', gen_random_uuid())$$, '42883', null, 'the old signature no longer exists');
select tests.as_person('viewer');
select throws_ok($$select app.poll_eligible_for('members', tests.pid('mem'))$$, '42501', null, 'a signed-in person cannot probe either');
select throws_ok($$select app.profile_visible(tests.pid('mem'))$$, '42883', null, 'profile_visible(uuid) is gone');
select is(app.poll_eligible_me('members'), false, 'a guest asking about themselves gets false');
select tests.as_person('mem');
select is(app.poll_eligible_me('members'), true, 'a member asking about themselves gets true');
select tests.as_owner();
insert into public.polls (title, options, audience, status) values ('{"mn":"Гишүүд","en":"m"}', '[{"id":"a","label":{"mn":"А","en":""}},{"id":"b","label":{"mn":"Б","en":""}}]', 'members', 'published');
select tests.as_person('mem');
select is((select count(*) from public.polls), 1::bigint, 'policies still work: a member sees the members poll');
select tests.as_person('viewer');
select is((select count(*) from public.polls), 0::bigint, 'and a guest does not');
select tests.as_owner();
update public.event_registrations set status = 'going' where event_id = tests.eid('hackx') and profile_id = tests.pid('viewer');
select tests.as_person('viewer');
select is(app.is_seated(tests.eid('hackx')), true, 'is_seated only answers for the caller (viewer registered)');
select tests.as_person('seated');
select is(app.is_seated(tests.eid('hackx')), false, 'someone else''s seat is invisible to them');
select is(app.has_registration(tests.eid('hackx')), false, 'and so is their registration');
select tests.as_anon();
select is((select app.subscribe('Бат', 'oracle@example.test')::text), (select app.subscribe('Бат', 'oracle@example.test')::text), 'subscribing twice looks identical to the caller (no who-is-subscribed oracle)');

-- 4. identity: no takeover through an unverified email ------------------------------------------------------------------------
select tests.as_owner();
select tests.profile('legacy1'); select tests.profile('legacy2');
update public.profiles set clerk_user_id = null, email = 'legacy1@example.test' where handle = 'legacy1';
update public.profiles set clerk_user_id = null, email = 'legacy2@example.test' where handle = 'legacy2';
select tests.staff('legacystaff', 'admin');
update public.profiles set clerk_user_id = null, email = 'staff.old@example.test' where handle = 'legacystaff';
select tests.as_service();
select isnt(app.upsert_clerk_profile('user_u1', 'legacy1@example.test', null, 'mn', false), tests.pid('legacy1'), 'an unverified email does not claim a legacy profile');
select tests.as_owner();
select is(tests.val($$select coalesce(clerk_user_id, 'unclaimed') from public.profiles where handle = 'legacy1'$$), 'unclaimed', 'the legacy profile stays unclaimed');
select is(tests.val($$select coalesce(email::text, 'no email') from public.profiles where clerk_user_id = 'user_u1'$$), 'no email', 'the separate profile stores no unverified address');
select tests.as_service();
select is(app.upsert_clerk_profile('user_v1', 'Legacy1@Example.test', null, 'mn', true), tests.pid('legacy1'), 'a verified email claims it');
select is(app.upsert_clerk_profile('user_v1', 'legacy1@example.test', null, 'mn', true), tests.pid('legacy1'), 'claiming is idempotent');
select throws_ok($$select app.upsert_clerk_profile('user_v2', 'legacy1@example.test', null, 'mn', true)$$, 'P0001', 'conflict', 'a second Clerk id cannot claim an already claimed profile');
select app.upsert_clerk_profile('user_v1', 'changed@example.test', null, 'mn', false);
select tests.as_owner();
select is(tests.val($$select email::text from public.profiles where handle = 'legacy1'$$), 'legacy1@example.test', 'an unverified address never replaces the stored one');
select tests.as_service();
select isnt(app.upsert_clerk_profile('user_s1', 'staff.old@example.test', null, 'mn', true), tests.pid('legacystaff'), 'a legacy staff profile is never auto-claimed, even with a verified email');
select app.upsert_clerk_profile('user_s1', 'staff.old@example.test', null, 'mn', true);
select tests.as_owner();
select is(tests.val($$select coalesce(clerk_user_id, 'unclaimed') from public.profiles where handle = 'legacystaff'$$), 'unclaimed', 'it stays unclaimed (an admin merges it by hand)');
select is(tests.count($$select 1 from public.audit_log where action = 'profile.claim_blocked'$$), 1::bigint, 'one profile.claim_blocked audit row, not repeated on retry');
select is(tests.count($$select 1 from public.staff_roles r join public.profiles p on p.id = r.profile_id where p.clerk_user_id = 'user_s1'$$), 0::bigint, 'the new profile carries no staff role');
select tests.as_person('adm');
select lives_ok($$select app.merge_profiles(tests.pid('legacystaff'), (select id from public.profiles where clerk_user_id = 'user_s1'))$$, 'an admin can merge the new profile into the legacy staff one via merge_profiles');

select * from finish();
rollback;
