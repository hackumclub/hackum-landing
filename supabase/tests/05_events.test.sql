begin;
select plan(43);
select tests.use_issuer();

select tests.profile(h) from unnest(array['a', 'b', 'c']) h;
select tests.staff('org', 'organizer');

-- create ---------------------------------------------------------------------------------------------------------------
select tests.as_person('a');
select throws_ok($$select app.create_event(tests.ei())$$, 'P0001', 'forbidden', 'only staff create events');
select tests.as_person('org');
select lives_ok($$select app.create_event(tests.ei())$$, 'staff create an event');
select tests.as_owner();
select is(tests.val($$select status || ':' || ics_sequence || ':' || tz || ':' || (created_by = tests.pid('org'))::text from public.events where slug = 'knowledge-day-7'$$), 'draft:0:Asia/Ulaanbaatar:true', 'it is a draft with sequence 0, created by the organizer');
select is(tests.count($$select 1 from public.audit_log where action = 'event.create'$$), 1::bigint, 'creation is audited');
select tests.as_person('org');
select throws_ok($$select app.create_event(tests.ei())$$, 'P0001', 'conflict', 'a duplicate slug conflicts');
select throws_ok(format($f$select app.create_event(tests.ei(%L))$f$, o), 'P0001', 'invalid', 'rejects ' || d)
from (values
  ('{"slug":"Bad Slug"}', 'a slug with capitals'), ('{"slug":"ab"}', 'a slug that is too short'),
  ('{"title":{"mn":" ","en":"x"}}', 'no Mongolian title'), ('{"ends_at":"2000-01-01T00:00:00Z"}', 'an end before the start'),
  ('{"capacity":0}', 'zero capacity'), ('{"capacity":5001}', 'capacity above 5000'),
  ('{"reg_closes_at":"2100-01-01T00:00:00Z"}', 'registration closing after the start'),
  ('{"reg_mode":"application"}', 'an application event without a decision deadline'),
  ('{"team_mode":"optional","team_size_min":4,"team_size_max":2}', 'teams with a minimum above the maximum'),
  ('{"mode":"online","online_url":"http://insecure.example.com"}', 'an online event without an https link'),
  ('{"questions":[{"id":"q","type":"short","label":{"mn":"a","en":"a"},"required":true},{"id":"q","type":"short","label":{"mn":"b","en":"b"},"required":false}]}', 'a duplicate question id'),
  ('{"kind":"party"}', 'an unknown kind')
) v(o, d);
select tests.as_owner();
select is(tests.count($$select 1 from public.events where slug <> 'knowledge-day-7'$$), 0::bigint, 'invalid input creates nothing');

-- editing a published event ---------------------------------------------------------------------------------------------
select tests.event('e1x', 10);
select tests.as_person('a'); select app.register_for_event(tests.eid('e1x'));
select tests.as_person('b'); select app.register_for_event(tests.eid('e1x'));
select tests.as_owner();
delete from public.notifications; delete from public.inbox;
select tests.as_person('org');
select is((select app.update_event(tests.eid('e1x'), tests.ei(jsonb_build_object('slug', 'e1x', 'capacity', 10,
  'starts_at', now() + interval '80 hours', 'ends_at', now() + interval '82 hours'))) ->> 'notified'), '2', 'a time change re-invites everyone going');
select tests.as_owner();
select is(tests.val($$select ics_sequence::text from public.events where slug = 'e1x'$$), '1', 'and bumps the invite sequence');
select is(tests.val($$select string_agg(distinct payload ->> 'changed', ';') from public.notifications where template = 'event_updated'$$), 'starts_at,ends_at,venue_name', 'the payload lists what changed (venue differs from the fixture too)');
select is(tests.count($$select 1 from public.inbox where kind = 'event_updated'$$), 2::bigint, 'each gets an inbox row');
select is(tests.count($$select 1 from public.audit_log where action = 'event.update' and diff ? 'starts_at'$$), 1::bigint, 'the diff is audited');
delete from public.notifications; delete from public.inbox;
select tests.as_person('org');
select is((select app.update_event(tests.eid('e1x'), tests.ei(jsonb_build_object('slug', 'e1x', 'capacity', 10, 'venue_name', 'МУИС 305',
  'starts_at', (select starts_at from public.events where slug = 'e1x'), 'ends_at', (select ends_at from public.events where slug = 'e1x'),
  'description', jsonb_build_object('mn', 'Шинэ тайлбар', 'en', '')))) ->> 'notified'), '0', 'a change nobody needs to hear about is quiet');
select tests.as_owner();
select is(tests.val($$select ics_sequence::text from public.events where slug = 'e1x'$$), '1', 'and the sequence stays');
select tests.as_person('org');
select is((select app.preview_event_change(tests.eid('e1x'), tests.ei(jsonb_build_object('slug', 'e1x', 'venue_name', 'Шинэ танхим',
  'starts_at', (select starts_at from public.events where slug = 'e1x'), 'ends_at', (select ends_at from public.events where slug = 'e1x')))) #>> '{changed}'), '["venue_name"]', 'the preview lists changed notify fields');
select is((select app.preview_event_change(tests.eid('e1x'), tests.ei(jsonb_build_object('slug', 'e1x', 'venue_name', 'Шинэ танхим'))) ->> 'will_notify'), '2', 'and who would be told');
select tests.as_owner();
select is(tests.val($$select venue_name from public.events where slug = 'e1x'$$), 'МУИС 305', 'a preview saves nothing');
-- drafts are edited quietly
select tests.event('draft-e', null, 'draft');
select tests.as_person('org');
select is((select app.update_event(tests.eid('draft-e'), tests.ei(jsonb_build_object('slug', 'draft-e'))) ->> 'notified'), '0', 'editing a draft notifies nobody');
-- queued reminders for the old time are skipped
select tests.as_owner();
insert into public.notifications (profile_id, template, priority, dedupe_key, payload)
  select tests.pid('a'), 'reminder_24h', 1, 'r-old', jsonb_build_object('event_id', id, 'starts_at', app.iso(starts_at)) from public.events where slug = 'e1x';
select tests.as_person('org');
select app.update_event(tests.eid('e1x'), tests.ei(jsonb_build_object('slug', 'e1x', 'capacity', 10, 'starts_at', now() + interval '90 hours', 'ends_at', now() + interval '92 hours')));
select tests.as_owner();
select is(tests.val($$select status::text from public.notifications where dedupe_key = 'r-old'$$), 'skipped', 'already-queued reminders that now point at the old time are skipped');

-- the online link is private to seat holders and staff -------------------------------------------------------------------
select tests.as_person('org');
select app.update_event(tests.eid('draft-e'), tests.ei(jsonb_build_object('slug', 'draft-e', 'mode', 'online', 'online_url', 'https://meet.example.test/room')));
select tests.as_owner();
select is(tests.val($$select online_url from public.event_online_links where event_id = tests.eid('draft-e')$$), 'https://meet.example.test/room', 'the link is stored beside the event');
select tests.as_person('org');
select app.update_event(tests.eid('draft-e'), tests.ei(jsonb_build_object('slug', 'draft-e', 'mode', 'offline', 'online_url', 'https://ignored.example.test')));
select tests.as_owner();
select is(tests.count($$select 1 from public.event_online_links where event_id = tests.eid('draft-e')$$), 0::bigint, 'going offline removes the link');

-- status ---------------------------------------------------------------------------------------------------------------
select tests.event('life', null, 'draft');
select tests.as_person('a');
select throws_ok($$select app.set_event_status(tests.eid('life'), 'published')$$, 'P0001', 'forbidden', 'only staff change status');
select tests.as_person('org');
select lives_ok($$select app.set_event_status(tests.eid('life'), 'published')$$, 'draft -> published');
select lives_ok($$select app.set_event_status(tests.eid('life'), 'completed')$$, 'published -> completed');
select lives_ok($$select app.set_event_status(tests.eid('life'), 'archived')$$, 'completed -> archived');
select throws_ok($$select app.set_event_status(tests.eid('life'), 'published')$$, 'P0001', 'conflict', 'archived cannot go back');
select throws_ok($$select app.set_event_status(tests.eid('life'), 'nonsense')$$, 'P0001', 'invalid', 'an unknown status is invalid');
select tests.as_owner();
select tests.event('cancel-me', 1);
select tests.as_person('a'); select app.register_for_event(tests.eid('cancel-me'));
select tests.as_person('b'); select app.register_for_event(tests.eid('cancel-me'));
select tests.as_owner();
insert into public.notifications (profile_id, template, priority, dedupe_key, payload) values (tests.pid('a'), 'reminder_24h', 1, 'r-9', jsonb_build_object('event_id', tests.eid('cancel-me')));
select tests.as_person('org');
select throws_ok($$select app.set_event_status(tests.eid('cancel-me'), 'draft')$$, 'P0001', 'conflict', 'a draft with registrations cannot go back to draft');
select lives_ok($$select app.set_event_status(tests.eid('cancel-me'), 'cancelled')$$, 'staff cancel');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'event_cancelled' and payload ->> 'event_slug' = 'cancel-me'$$), 2::bigint, 'everyone with a seat or a waitlist spot is told');
select is(tests.val($$select status::text from public.notifications where dedupe_key = 'r-9'$$), 'skipped', 'queued reminders are dropped');
select is(tests.count($$select 1 from public.audit_log where action = 'event.status'$$), 4::bigint, 'every status change is audited');

select * from finish();
rollback;
