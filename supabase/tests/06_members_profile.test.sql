begin;
select plan(85);
select tests.use_issuer();

select tests.profile('fresh', 'guest', 'num', 'software', false);
select tests.profile('g'); select tests.profile('late'); select tests.profile('mem', 'member');
select tests.profile('must1', 'guest', 'must', 'software'); select tests.profile('nomajor', 'guest', 'num', null);
select tests.profile('dup'); select tests.profile('keep'); select tests.profile('extra');
select tests.staff('org', 'organizer'); select tests.staff('adm', 'admin');
insert into public.seasons (year, label, application_opens_at, application_closes_at, is_current) values
  (2026, '{"mn":"2026","en":"2026"}', null, null, true),
  (2027, '{"mn":"2027","en":"2027"}', now() - interval '14 days', now() + interval '35 days', false);

-- onboarding and preferences ---------------------------------------------------------------------------------------------
select tests.as_person('fresh');
select throws_ok(format($f$select app.complete_onboarding(%L::jsonb, %L, %s, 'mn')$f$, n, s, y), 'P0001', 'invalid', 'onboarding rejects ' || d)
from (values ('{"mn":"А","en":"A"}', 'МУИС', 1999, 'a graduation year before 2000'), ('{"mn":"А","en":"A"}', 'МУИС', 2041, 'a graduation year after 2040'),
  ('{"mn":"  ","en":"A"}', 'МУИС', 2028, 'a blank Mongolian name'), ('{"mn":"А","en":"A"}', '', 2028, 'an empty school')) v(n, s, y, d);
select lives_ok($$select app.complete_onboarding('{"mn":"Анужин","en":"Anujin"}', 'МУИС', 2028, 'mn')$$, 'onboarding completes');
select app.complete_onboarding('{"mn":"Анужин","en":"Anujin"}', 'МУИС', 2028, 'mn');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'welcome' and profile_id = tests.pid('fresh')$$), 1::bigint, 'completing twice queues a single welcome email');
select is(tests.val($$select (onboarded_at is not null)::text || ':' || grad_year from public.profiles where handle = 'fresh'$$), 'true:2028', 'onboarded_at and grad_year are set');
select tests.as_person('g');
select lives_ok($$select app.update_prefs('{"reminders":false,"updates":true,"announcements":false}', 'en', 'members')$$, 'preferences save');
select tests.as_owner();
select is(tests.val($$select locale || ':' || (notif_prefs ->> 'reminders') || ':' || (notif_prefs ->> 'announcements') from public.profiles where handle = 'g'$$), 'en:false:false', 'and persist');
select tests.as_person('g');
select throws_ok($$select app.update_prefs('{"reminders":false,"updates":true,"announcements":false}', 'en', 'everyone')$$, 'P0001', 'invalid', 'an unknown visibility is invalid');
select throws_ok($$select app.update_prefs('{"reminders":false}', 'en', 'members')$$, 'P0001', 'invalid', 'incomplete prefs are invalid');
select lives_ok($$select app.update_profile('{"mn":"Бат","en":"Bat"}', 2027, '{"github":"https://github.com/bat","web":""}', 'public', 'mn')$$, 'update_profile saves name, links, visibility');
select tests.as_owner();
select is(tests.val($$select links::text || ':' || visibility from public.profiles where handle = 'g'$$), '{"github": "https://github.com/bat"}:public', 'blank links are dropped');
select tests.as_person('g');
select throws_ok($$select app.update_profile('{"mn":"Бат","en":"Bat"}', 2027, '{"github":"javascript:alert(1)"}', 'public', 'mn')$$, 'P0001', 'invalid', 'a non-https link is invalid');
select throws_ok($$select app.update_profile('{"mn":"Бат","en":"Bat"}', 2027, '{"a1":"https://x.com"}', 'public', 'mn')$$, 'P0001', 'invalid', 'a link key must be letters');
select throws_ok($$select app.update_profile('{"mn":"","en":"Bat"}', 2027, '{}', 'public', 'mn')$$, 'P0001', 'invalid', 'a blank Mongolian name is invalid');
select throws_ok($$select app.update_profile('{"mn":"Бат","en":"Bat"}', 1990, '{}', 'public', 'mn')$$, 'P0001', 'invalid', 'a graduation year out of range is invalid');
select tests.as_owner();
select is(tests.count($$select 1 from public.audit_log where action = 'profile.update'$$), 1::bigint, 'profile edits are audited');

-- academic --------------------------------------------------------------------------------------------------------------
select tests.as_person('must1');
select lives_ok($$select app.update_academic('num', '', 'cs', 'D 061301', 'Компьютерын ухаан')$$, 'a student declares NUM');
select tests.as_owner();
select is(tests.val($$select school_id || ':' || school || ':' || major_track || ':' || program_index || ':' || major from public.profiles where handle = 'must1'$$), 'num:МУИС:cs:D 061301:Компьютерын ухаан', 'school, track, program stored; display school set for NUM');
select tests.as_person('must1');
select app.update_academic('other', '  Khovd University ', 'software', 'D 061302', 'Software');
select tests.as_owner();
select is(tests.val($$select school || ':' || coalesce(program_index, 'null') from public.profiles where handle = 'must1'$$), 'Khovd University:null', 'a non-NUM school drops the program and keeps the typed name');
select tests.as_person('must1');
select throws_ok(format($f$select app.update_academic(%L, %L, %L, null, %L)$f$, a, b, c, e), 'P0001', 'invalid', 'academic rejects ' || d)
from (values ('harvard', '', 'cs', '', 'an unknown school id'), ('other', ' ', 'cs', '', '''other'' without a school name'),
  ('num', '', 'art', '', 'an unknown track'), ('num', '', 'cs', repeat('x', 81), 'an 81-char major label')) v(a, b, c, e, d);

-- semesters -------------------------------------------------------------------------------------------------------------
select tests.as_person('g');
select is((select app.set_semester_subjects(2026, 'autumn', array[' Algorithms ', 'algorithms', '', 'Databases'], true) -> 'subjects'), '["Algorithms", "Databases"]'::jsonb, 'subjects are trimmed, deduplicated case-insensitively, empties dropped');
select app.set_semester_subjects(2026, 'autumn', array['Networks'], false);
select is((select count(*) from public.profile_semesters), 1::bigint, 'one row per profile and semester (upsert)');
select lives_ok($$select app.set_semester_subjects(2026, 'spring', array(select 'S' || i from generate_series(1, 12) i), true)$$, '12 subjects are fine');
select throws_ok($$select app.set_semester_subjects(2025, 'spring', array(select 'S' || i from generate_series(1, 13) i), true)$$, 'P0001', 'invalid', '13 are not');
select throws_ok($$select app.set_semester_subjects(2025, 'spring', array[repeat('x', 81)], true)$$, 'P0001', 'invalid', 'an 81-char subject is not');
select throws_ok($$select app.set_semester_subjects(2025, 'summer', array['x'], true)$$, 'P0001', 'invalid', 'a bad term is not');
select throws_ok($$select app.set_semester_subjects(1999, 'spring', array['x'], true)$$, 'P0001', 'invalid', 'a bad year is not');

-- avatars -----------------------------------------------------------------------------------------------------------------
select lives_ok(format($f$select app.set_avatar_path(%L)$f$, tests.pid('g')::text), 'a person records their own avatar path');
select throws_ok(format($f$select app.set_avatar_path(%L)$f$, tests.pid('mem')::text), 'P0001', 'invalid', 'but not someone else''s');
select lives_ok($$select app.remove_avatar()$$, 'removing clears it');

-- membership applications -------------------------------------------------------------------------------------------------
select tests.as_person('g');
select throws_ok($$select app.apply_for_membership('short', '{}')$$, 'P0001', 'invalid', 'thin motivation is invalid');
select is((select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', array['Dev']) ? 'id'), true, 'a NUM student with a major applies while the window is open');
select tests.as_owner();
select is(tests.val($$select season || ':' || status from public.membership_applications where profile_id = tests.pid('g')$$), '2027:pending', 'recorded as pending for season 2027');
select is(tests.count($$select 1 from public.inbox where kind = 'staff_application'$$), 2::bigint, 'every staff member gets an inbox item');
select tests.as_person('g');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}')$$, 'P0001', 'conflict', 'a duplicate application conflicts');
select tests.as_person('mem');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}')$$, 'P0001', 'conflict', 'a member cannot apply');
select tests.as_person('must1');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}')$$, 'P0001', 'ineligible', 'another school is ineligible (NUM-only rule)');
select tests.as_person('nomajor');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}')$$, 'P0001', 'ineligible', 'a NUM student without a major is ineligible');
select tests.as_owner();
select is(tests.count($$select 1 from public.membership_applications$$), 1::bigint, 'refusals write nothing');
update public.forms set questions = '[{"id":"experience","type":"select","label":{"mn":"Туршлага","en":"Experience"},"required":true,"options":[{"mn":"А","en":"A"},{"mn":"Б","en":"B"}]}]' where id = 'membership_application';
select tests.as_person('dup');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}', '{}')$$, 'P0001', 'invalid', 'the club''s required question must be answered');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}', '{"experience":"7"}')$$, 'P0001', 'invalid', 'and the option must exist');
select lives_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}', '{"experience":"1","ignored":"x"}')$$, 'a valid answer passes');
select tests.as_owner();
select is(tests.val($$select answers::text from public.membership_applications where profile_id = tests.pid('dup')$$), '{"experience": "1"}', 'unknown answers are dropped');
update public.seasons set application_closes_at = now() - interval '1 hour' where year = 2027;
select tests.as_person('late');
select throws_ok($$select app.apply_for_membership('Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.', '{}', '{"experience":"0"}')$$, 'P0001', 'closed', 'closed when no season window is open');
select tests.as_owner();
update public.seasons set application_closes_at = now() + interval '35 days' where year = 2027;

-- review -------------------------------------------------------------------------------------------------------------------
select tests.as_person('g');
select throws_ok($$select app.review_membership((select id from public.my_membership_applications limit 1), true, '')$$, 'P0001', 'forbidden', 'only staff review');
select tests.as_person('org');
select throws_ok($$select app.review_membership(gen_random_uuid(), true, '')$$, 'P0001', 'not_found', 'an unknown application is not_found');
select lives_ok($$select app.review_membership((select id from public.membership_applications where profile_id = tests.pid('g')), true, 'solid')$$, 'staff approve');
select tests.as_owner();
select is(tests.val($$select status::text || ':' || (select count(*) from public.memberships m where m.profile_id = p.id and m.season = 2027 and m.team = 'Dev') from public.profiles p where handle = 'g'$$), 'member:1', 'approval adds the roster entry (team = first interest) and promotes the person');
select is(tests.count($$select 1 from public.notifications where template = 'membership_approved' and profile_id = tests.pid('g') and not payload::text like '%solid%'$$), 1::bigint, 'with an email that never carries the staff note');
select tests.as_person('org');
select throws_ok($$select app.review_membership((select id from public.membership_applications where profile_id = tests.pid('g')), false, '')$$, 'P0001', 'conflict', 'a reviewed application cannot be reviewed again');
select tests.as_owner();
insert into public.membership_applications (profile_id, season, motivation) values (tests.pid('must1'), 2027, 'I would like to take part');
select tests.as_person('org');
select throws_ok($$select app.review_membership((select id from public.membership_applications where profile_id = tests.pid('must1')), true, '')$$, 'P0001', 'ineligible', 'approval refuses a non-NUM applicant');
select lives_ok($$select app.review_membership((select id from public.membership_applications where profile_id = tests.pid('must1')), false, 'not NUM')$$, 'but staff may reject');
select tests.as_person('must1');
select is((select count(*) from public.my_membership_applications), 1::bigint, 'the applicant sees their rejection (without the note column)');

-- bulk status and merge -----------------------------------------------------------------------------------------------------
select tests.as_person('org');
select is((select app.set_member_status(array[tests.pid('late'), tests.pid('extra')], 'alumni') ->> 'changed'), '2', 'staff change status in bulk');
select tests.as_person('late');
select throws_ok($$select app.set_member_status(array[tests.pid('late')], 'member')$$, 'P0001', 'forbidden', 'only staff change member status');
select tests.as_owner();
select tests.event('merge-ev', null);
insert into public.event_registrations (event_id, profile_id, status) values (tests.eid('merge-ev'), tests.pid('keep'), 'going'), (tests.eid('merge-ev'), tests.pid('dup'), 'going');
insert into public.memberships (profile_id, season) values (tests.pid('dup'), 2026), (tests.pid('keep'), 2026), (tests.pid('dup'), 2025);
select tests.as_person('org');
select throws_ok($$select app.merge_profiles(tests.pid('keep'), tests.pid('dup'))$$, 'P0001', 'forbidden', 'only admins merge');
select tests.as_person('adm');
select throws_ok($$select app.merge_profiles(tests.pid('keep'), tests.pid('keep'))$$, 'P0001', 'invalid', 'a profile cannot merge into itself');
select lives_ok($$select app.merge_profiles(tests.pid('keep'), tests.pid('dup'))$$, 'an admin merges a duplicate');
select tests.as_owner();
select is(tests.val($$select (select count(*) from public.event_registrations where profile_id = tests.pid('keep')) || ':' || (select count(*) from public.memberships where profile_id = tests.pid('keep')) || ':' || (select count(*) from public.event_registrations where profile_id = (select id from public.profiles where handle::text like 'dup-merged-%'))$$), '1:2:0', 'rows move over, true duplicates are dropped');
select is(tests.val($$select (deleted_at is not null)::text || ':' || coalesce(email::text, 'null') || ':' || coalesce(clerk_user_id, 'null') || ':' || (handle::text like 'dup-merged-%') from public.profiles where handle::text like 'dup-merged-%'$$), 'true:null:null:true', 'the dropped profile is anonymised');

-- roles and seasons -----------------------------------------------------------------------------------------------------------
select tests.as_person('org');
select throws_ok($$select app.grant_role(tests.pid('g'), 'organizer')$$, 'P0001', 'forbidden', 'only admins grant roles');
select tests.as_person('adm');
select lives_ok($$select app.grant_role(tests.pid('g'), 'organizer')$$, 'an admin grants a role');
select throws_ok($$select app.grant_role(tests.pid('adm'), null)$$, 'P0001', 'conflict', 'an admin cannot remove their own admin role');
select throws_ok($$select app.grant_role(tests.pid('adm'), 'organizer')$$, 'P0001', 'conflict', 'nor demote themselves, so the club never has no admin');
select lives_ok($$select app.grant_role(tests.pid('extra'), 'admin')$$, 'a second admin is added');
select tests.as_person('extra');
select lives_ok($$select app.grant_role(tests.pid('adm'), 'organizer')$$, 'another admin may demote the first');
select throws_ok($$select app.grant_role(tests.pid('extra'), 'organizer')$$, 'P0001', 'conflict', 'but the last admin cannot be demoted');
select throws_ok($$select app.grant_role(tests.pid('g'), 'owner')$$, 'P0001', 'invalid', 'an unknown role is invalid');
select tests.as_person('org');
select throws_ok($$select app.upsert_season('{"year":2030,"label":{"mn":"x","en":"x"},"is_current":true}')$$, 'P0001', 'forbidden', 'only admins edit seasons');
select tests.as_person('extra');
select lives_ok($$select app.upsert_season('{"year":2027,"label":{"mn":"2027","en":"2027"},"is_current":true}')$$, 'an admin makes 2027 current');
select is((select count(*) from public.seasons where is_current), 1::bigint, 'exactly one season is current');
select throws_ok($$select app.upsert_season('{"year":2027,"label":{"mn":"2027","en":"2027"},"is_current":false}')$$, 'P0001', 'conflict', 'the only current season cannot be un-marked');
select throws_ok($$select app.upsert_season('{"year":2028,"label":{"mn":"x","en":"x"},"application_opens_at":"2030-01-02T00:00:00Z","application_closes_at":"2030-01-01T00:00:00Z"}')$$, 'P0001', 'invalid', 'a window that closes before it opens is invalid');

-- forms and the newsletter -------------------------------------------------------------------------------------------------------
select tests.as_person('mem');
select throws_ok($$select app.update_form('join', '[]')$$, 'P0001', 'forbidden', 'only staff edit forms');
select tests.as_person('org');
select throws_ok($$select app.update_form('join', '[{"id":"q","type":"select","label":{"mn":"x","en":""},"required":false}]')$$, 'P0001', 'invalid', 'a select question needs two options');
select lives_ok($$select app.update_form('join', '[{"id":"goal","type":"short","label":{"mn":"Зорилго","en":"Goal"},"required":false}]')$$, 'staff edit the join form');
select tests.as_person('g');
select app.submit_join_form('{"goal":"AI"}'); select app.submit_join_form('{"goal":"Web"}');
select is((select count(*) from public.form_submissions), 1::bigint, 'one join submission per person, the newest wins');
select tests.as_anon();
select is((select app.subscribe('Бат', 'Bat@Example.COM', 'mn', 'footer') ->> 'created'), 'true', 'the public newsletter takes a sign-up');
select is((select app.subscribe('Бат', 'bat@example.com', 'mn', 'footer') ->> 'created'), 'false', 'a repeated address (any case) is a silent success');
select throws_ok($$select app.subscribe('Бат', 'not-an-email')$$, 'P0001', 'invalid', 'a bad address is invalid');

select * from finish();
rollback;
