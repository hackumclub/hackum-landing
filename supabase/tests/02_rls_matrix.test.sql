begin;
select plan(54);
select tests.use_issuer();

-- fixtures (as owner)
select tests.profile('alice');
select tests.profile('bob', 'guest', 'num', 'software', true, 'private');
select tests.profile('carol', 'member', 'num', 'software', true, 'public');
select tests.profile('dan', 'alumni');
select tests.staff('org', 'organizer');
select tests.staff('adm', 'admin');
select tests.event('pub'); select tests.event('drf', null, 'draft'); select tests.event('done', null, 'completed', '-5 days');
select tests.event('arc', null, 'archived', '-90 days'); select tests.event('cnx', null, 'cancelled');
insert into public.event_online_links (event_id, online_url) values (tests.eid('pub'), 'https://meet.example.test/x');
insert into public.event_registrations (event_id, profile_id, status) values
  (tests.eid('pub'), tests.pid('alice'), 'going'), (tests.eid('pub'), tests.pid('bob'), 'going'), (tests.eid('cnx'), tests.pid('alice'), 'going');
insert into public.inbox (profile_id, kind, dedupe_key) values (tests.pid('alice'), 'welcome', 'k-alice'), (tests.pid('bob'), 'welcome', 'k-bob');
insert into public.notifications (profile_id, template, priority, dedupe_key) values (tests.pid('bob'), 'welcome', 0, 'n-bob');
insert into public.event_feedback (event_id, profile_id, rating, nps) values (tests.eid('done'), tests.pid('bob'), 4, 8);
insert into public.polls (title, options, audience, anonymous, status) values
  ('{"mn":"Нээлттэй","en":"open"}', '[{"id":"a","label":{"mn":"A","en":"A"}},{"id":"b","label":{"mn":"B","en":"B"}}]', 'members', false, 'published'),
  ('{"mn":"Нууц","en":"secret"}', '[{"id":"a","label":{"mn":"A","en":"A"}},{"id":"b","label":{"mn":"B","en":"B"}}]', 'members', true, 'published'),
  ('{"mn":"Ноорог","en":"draft"}', '[{"id":"a","label":{"mn":"A","en":"A"}},{"id":"b","label":{"mn":"B","en":"B"}}]', 'members', false, 'draft');
insert into public.poll_votes (poll_id, profile_id, option_ids) select id, tests.pid('carol'), array['a'] from public.polls where status = 'published';
insert into public.memberships (profile_id, season) values (tests.pid('carol'), 2026), (tests.pid('bob'), 2026);
insert into public.timeline_milestones (year, title) values (2017, '{"mn":"Эхлэл","en":"Start"}');
insert into public.audit_log (action, entity, entity_id) values ('test.seed', 'tests', 'x');
insert into public.seasons (year, label) values (2026, '{"mn":"2026","en":"2026"}');
insert into public.membership_applications (profile_id, season, motivation, review_note) values (tests.pid('alice'), 2026, 'I want to join the club', 'staff only note');

-- anon
select tests.as_anon();
select is((select count(*) from public.events), 3::bigint, 'anon sees only published, completed, archived events');
select is((select count(*) from public.events where slug in ('drf', 'cnx')), 0::bigint, 'anon cannot read drafts or cancelled events');
select is((select count(*) from public.public_profiles), 1::bigint, 'anon sees only public-visibility profiles');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'public_profiles' and column_name in ('email', 'calendar_token', 'clerk_user_id')), 0::bigint, 'public_profiles exposes no email, token or Clerk id');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.event_registrations$$, '42501', null, 'anon cannot read registrations');
select throws_ok($$select * from public.inbox$$, '42501', null, 'anon cannot read inbox');
select is((select count(*) from public.timeline_milestones), 1::bigint, 'anon reads the timeline');
select is((select count(*) from public.memberships), 1::bigint, 'anon sees the roster of public profiles only');
select throws_ok($$select app.register_for_event(gen_random_uuid())$$, '42501', null, 'anon cannot call register_for_event');
select throws_ok($$select * from public.member_profiles$$, '42501', null, 'anon cannot read the members directory view');
select throws_ok($$insert into public.events (slug, kind, title, starts_at, ends_at) values ('x-evt', 'other', '{"mn":"x","en":""}', now(), now() + interval '1 h')$$, '42501', null, 'anon cannot write events');

-- a signed-in guest
select tests.as_person('alice');
select is((select count(*) from public.profiles), 1::bigint, 'a guest reads only their own profile row');
select is((select count(*) from public.member_profiles), 5::bigint, 'a guest reads members/public profiles through the directory view (private ones hidden)');
select is((select count(*) from public.member_profiles where handle = 'bob'), 0::bigint, 'a private profile is not in the directory');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'member_profiles' and column_name in ('email', 'calendar_token')), 0::bigint, 'the directory view has no email or calendar token');
select is((select count(*) from public.event_registrations), 2::bigint, 'a person reads only their own registrations');
select is((select count(*) from public.event_registrations where profile_id = tests.pid('bob')), 0::bigint, 'not other people''s registrations');
select is((select count(*) from public.inbox), 1::bigint, 'a person reads only their own inbox');
select is((select count(*) from public.event_feedback), 0::bigint, 'not other people''s feedback');
select is((select count(*) from public.notifications), 0::bigint, 'the outbox is staff only');
select is((select count(*) from public.poll_votes), 0::bigint, 'a guest cannot read votes');
select is((select count(*) from public.polls), 0::bigint, 'a guest sees no member-only polls');
select is((select count(*) from public.membership_applications), 0::bigint, 'the applications table is staff only');
select is((select count(*) from public.my_membership_applications), 1::bigint, 'the applicant reads their own application through the view');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'my_membership_applications' and column_name in ('review_note', 'reviewed_by')), 0::bigint, 'the applicant view hides review_note and reviewer');
select is((select count(*) from public.events where slug = 'cnx'), 1::bigint, 'a registrant still sees their cancelled event');
select is((select count(*) from public.event_online_links), 1::bigint, 'a seated person reads the online link');
select is((select count(*) from public.audit_log), 0::bigint, 'a guest cannot read the audit log');
select throws_ok($$update public.profiles set name = '{"mn":"Шинэ","en":"New"}' where id = tests.pid('alice')$$, '42501', null, 'a person cannot update their profile directly (update_profile validates)');
select throws_ok($$update public.profiles set status = 'member' where id = tests.pid('alice')$$, '42501', null, 'a guest cannot change their own status');
select throws_ok($$update public.profiles set clerk_user_id = 'user_other' where id = tests.pid('alice')$$, '42501', null, 'nor their clerk_user_id');
select throws_ok($$update public.profiles set deleted_at = now() where id = tests.pid('alice')$$, '42501', null, 'nor deleted_at');
select throws_ok($$update public.profiles set name = '{"mn":"Hack","en":"x"}' where id = tests.pid('bob')$$, '42501', null, 'and certainly not someone else''s');
select lives_ok($$select app.update_academic('must', '', 'software', null, '')$$, 'school and major change through update_academic');
select throws_ok($$insert into public.event_registrations (event_id, profile_id, status) values (tests.eid('pub'), tests.pid('alice'), 'going')$$, '42501', null, 'no direct registration insert');
select throws_ok($$update public.inbox set read_at = now()$$, '42501', null, 'no direct inbox update');
select throws_ok($$insert into public.timeline_milestones (year, title) values (2030, '{"mn":"x","en":""}')$$, '42501', null, 'a guest cannot write the timeline');

-- a member sees member-only polls; votes only their own on the anonymous poll
select tests.as_person('carol');
select is((select count(*) from public.polls), 2::bigint, 'a member sees published polls (not drafts)');
select is((select count(*) from public.poll_votes), 2::bigint, 'a member sees their own votes');

-- an organizer (staff, not admin)
select tests.as_person('org');
select is((select count(*) from public.events), 5::bigint, 'staff see drafts and cancelled events');
select is((select count(*) from public.event_registrations), 3::bigint, 'staff read all registrations');
select is((select count(*) from public.notifications), 1::bigint, 'staff read the outbox');
select is((select count(*) from public.profiles), 6::bigint, 'staff read all profiles');
select is((select count(*) from public.poll_votes), 1::bigint, 'staff see voters only of the non-anonymous poll');
select is((select count(*) from public.event_feedback), 0::bigint, 'staff cannot read raw feedback rows (authors stay hidden)');
select is((select count(*) from public.audit_log), 0::bigint, 'an organizer cannot read the audit log');
select throws_ok($$select app.grant_role(tests.pid('alice'), 'organizer')$$, 'P0001', 'forbidden', 'an organizer cannot grant roles');
select lives_ok($$insert into public.timeline_milestones (year, title) values (2030, '{"mn":"Шинэ","en":"New"}')$$, 'staff write the timeline');

-- an admin
select tests.as_person('adm');
select ok((select count(*) from public.audit_log) >= 2, 'an admin reads the audit log (timeline edit by staff was audited)');
select lives_ok($$select app.grant_role(tests.pid('alice'), 'organizer')$$, 'an admin grants roles');
select is((select count(*) from public.staff_roles), 3::bigint, 'the new role exists');

-- a token from the wrong issuer is nobody
select tests.as_person('adm', 'https://evil.example.test');
select is((select count(*) from public.profiles), 0::bigint, 'a token from another issuer reads nothing');
select throws_ok($$select app.grant_role(tests.pid('bob'), 'admin')$$, 'P0001', 'unauthenticated', 'and cannot call rule functions');

select * from finish();
rollback;
