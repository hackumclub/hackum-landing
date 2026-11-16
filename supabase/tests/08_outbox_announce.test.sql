begin;
select plan(59);
select tests.use_issuer();

select tests.profile('m1', 'member'); select tests.profile('m2', 'member'); select tests.profile('m3', 'member'); select tests.profile('quiet', 'member');
select tests.profile('alum', 'alumni'); select tests.profile('guest1'); select tests.profile('legacy', 'member', 'num', 'software', false);
update public.profiles set notif_prefs = '{"reminders":true,"updates":true,"announcements":false}' where handle = 'quiet';
update public.profiles set email = null where handle = 'legacy';
select tests.staff('org', 'organizer'); select tests.staff('org2', 'organizer');
insert into public.subscribers (email, name) values ('sub1@example.test', 'Sub One'), ('sub2@example.test', 'Sub Two'), ('M1@example.test', 'Same as m1');

-- announcements -----------------------------------------------------------------------------------------------------------------
select tests.as_person('m1');
select throws_ok($$select app.send_announcement('k0', '{"kind":"members"}', '{"mn":"Сэдэв","en":"S"}', '{"mn":"Агуулга","en":"B"}')$$, 'P0001', 'forbidden', 'announcements are staff only');
select tests.as_person('org');
select is((select app.send_announcement('k1', '{"kind":"members"}', '{"mn":"Сэдэв","en":"Subject"}', '{"mn":"Агуулга","en":"Body"}')::text),
  '{"days": 1, "queued": 5, "opted_out": 1}', 'members: onboarded members with an address, opted-out skipped (2 staff + m1 + m2 + m3)');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'announcement' and dedupe_key like 'ann:k1:%' and priority = 2$$), 5::bigint, 'one email per person, priority 2');
select is(tests.count($$select 1 from public.inbox where kind = 'announcement' and dedupe_key like 'ann:k1:%'$$), 5::bigint, 'and one in-app item');
select is(tests.val($$select payload ->> 'subject_en' || '/' || (payload ->> 'subject_mn') || '/' || (payload ->> 'body_en') from public.notifications where dedupe_key = 'ann:k1:' || tests.pid('m1')$$), 'Subject/Сэдэв/Body', 'both languages travel in the payload');
select is(tests.count($$select 1 from public.notifications where dedupe_key = 'ann:k1:' || tests.pid('legacy') or dedupe_key = 'ann:k1:' || tests.pid('quiet')$$), 0::bigint, 'an unclaimed legacy profile (no address) and an opted-out person get nothing');
select tests.as_person('org');
select is((select app.send_announcement('k1', '{"kind":"members"}', '{"mn":"Сэдэв","en":"Subject"}', '{"mn":"Агуулга","en":"Body"}') ->> 'queued'), '0', 'a double click (same key) queues nothing the second time');
select is((select app.send_announcement('k2', '{"kind":"community"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}') ->> 'queued'), '6', 'community adds alumni');
select is((select app.send_announcement('k3', '{"kind":"everyone"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}') ->> 'queued'), '7', 'everyone adds guests (onboarded accounts only)');
select is((select app.send_announcement('k4', '{"kind":"subscribers"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}') ->> 'queued'), '2', 'subscribers: addresses that are not already an account');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where to_email is not null and profile_id is null and dedupe_key like 'ann:k4:%'$$), 2::bigint, 'mailed by address');
select is(tests.count($$select 1 from public.inbox where dedupe_key like 'ann:k4:%'$$), 0::bigint, 'with no in-app item');
select tests.event('ann-ev', null);
insert into public.event_registrations (event_id, profile_id, status) values
  (tests.eid('ann-ev'), tests.pid('m1'), 'going'), (tests.eid('ann-ev'), tests.pid('guest1'), 'waitlisted'), (tests.eid('ann-ev'), tests.pid('alum'), 'cancelled');
select tests.as_person('org2');
select is((select app.send_announcement('k5', jsonb_build_object('kind', 'event', 'event_id', tests.eid('ann-ev'), 'statuses', jsonb_build_array('going', 'waitlisted', 'cancelled')), '{"mn":"С","en":""}', '{"mn":"А","en":""}') ->> 'queued'), '2', 'the event audience follows registration status and never includes cancelled');
select throws_ok($$select app.send_announcement('k6', '{"kind":"event","event_id":"00000000-0000-0000-0000-000000000000","statuses":["going"]}', '{"mn":"С","en":""}', '{"mn":"А","en":""}')$$, 'P0001', 'invalid', 'an unknown event is invalid');
select throws_ok(format($f$select app.send_announcement('k7', jsonb_build_object('kind', 'event', 'event_id', %L, 'statuses', '[]'::jsonb), '{"mn":"С","en":""}', '{"mn":"А","en":""}')$f$, tests.eid('ann-ev')), 'P0001', 'invalid', 'an empty status list is invalid');
select throws_ok(format($f$select app.send_announcement(%L, %L::jsonb, %L::jsonb, %L::jsonb)$f$, k, a, s, b), 'P0001', 'invalid', 'announcements reject ' || d)
from (values
  ('', '{"kind":"members"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}', 'an empty key'),
  (repeat('k', 65), '{"kind":"members"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}', 'a key over 64 chars'),
  ('kx', '{"kind":"members"}', '{"mn":" ","en":""}', '{"mn":"А","en":""}', 'a blank Mongolian subject'),
  ('kx', '{"kind":"members"}', json_build_object('mn', repeat('x', 121), 'en', '')::text, '{"mn":"А","en":""}', 'a 121-char subject'),
  ('kx', '{"kind":"members"}', '{"mn":"С","en":""}', '{"mn":"","en":""}', 'a blank body'),
  ('kx', '{"kind":"nobody"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}', 'an unknown audience')
) v(k, a, s, b, d);
select tests.as_owner();
select is(tests.count($$select 1 from public.audit_log where action = 'announcement.send' and entity_id = 'kx'$$), 0::bigint, 'invalid input is never audited or sent');
select is(tests.val($$select (diff ->> 'audience') || ':' || (diff ->> 'queued') || ':' || (diff ? 'body')::text from public.audit_log where action = 'announcement.send' and entity_id = 'k1'$$), 'members:5:false', 'the audit records who sent what to whom, without the body');
-- rate limit: 5 an hour per sender (k1..k5 already sent by org)
select tests.as_person('org');
select throws_ok($$select app.send_announcement('k8', '{"kind":"members"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}')$$, 'P0001', 'rate_limited', 'a sixth announcement in an hour is rate limited');
select tests.as_person('org2');
select lives_ok($$select app.send_announcement('k8', '{"kind":"members"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}')$$, 'but another sender is not');
-- days from the free daily budget (80 a day)
select tests.as_owner();
insert into public.profiles (handle, clerk_user_id, email, name, status, onboarded_at)
  select 'bulk' || i, 'user_bulk' || i, 'bulk' || i || '@example.test', '{"mn":"Б","en":"B"}', 'member', now() from generate_series(1, 170) i;
select tests.as_person('org2');
select is((select app.send_announcement('k9', '{"kind":"members"}', '{"mn":"С","en":""}', '{"mn":"А","en":""}') ->> 'days'), '3', '175 recipients at 80 a day is three days');

-- inbox -------------------------------------------------------------------------------------------------------------------------
select tests.as_owner();
select tests.profile('inb1'); select tests.profile('inb2');
insert into public.inbox (profile_id, kind, dedupe_key) values (tests.pid('inb1'), 'welcome', 'i1'), (tests.pid('inb1'), 'announcement', 'i2'), (tests.pid('inb2'), 'welcome', 'i3');
select tests.as_person('inb1');
select is((select app.mark_read(array[(select id from public.inbox where dedupe_key = 'i1')]) ->> 'changed'), '1', 'a person marks their own item read');
select is((select app.mark_read(array[tests.val($$select id::text from public.inbox where dedupe_key = 'i3'$$)::uuid]) ->> 'changed'), '0', 'ids that belong to someone else are ignored');
select is((select app.mark_all_read() ->> 'changed'), '1', 'mark all read changes the rest');
select tests.as_owner();
select is(tests.count($$select 1 from public.inbox where dedupe_key = 'i3' and read_at is not null$$), 0::bigint, 'the other person''s item stays unread');
select tests.as_anon();
select throws_ok($$select app.mark_all_read()$$, '42501', null, 'anonymous visitors cannot mark anything');

-- enqueue_notification (service side) -------------------------------------------------------------------------------------------
select tests.as_service();
select is(app.enqueue_notification(tests.pid('m1'), 'rsvp_confirmed', '{"x":1}', 0::smallint, 'dk-1'), true, 'the outbox accepts a message');
select is(app.enqueue_notification(tests.pid('m1'), 'rsvp_confirmed', '{"x":1}', 0::smallint, 'dk-1'), false, 'a repeated dedupe key is a no-op');
select is(app.enqueue_notification(tests.pid('quiet'), 'announcement', '{}', 2::smallint, 'dk-2'), true, 'an opted-out recipient still gets an outbox row (the dispatcher skips it)');
select tests.as_owner();
select is(tests.count($$select 1 from public.inbox where dedupe_key = 'dk-1'$$), 1::bigint, 'the inbox row exists once');
select is(tests.count($$select 1 from public.inbox where dedupe_key = 'dk-2'$$), 0::bigint, 'but the in-app item respects the announcements preference');
select tests.as_person('m1');
select throws_ok($$select app.enqueue_notification(tests.pid('m2'), 'welcome', '{}', 0::smallint, 'spam')$$, '42501', null, 'a person cannot write to someone else''s outbox');
select tests.as_owner();
select throws_ok($$insert into public.notifications (profile_id, to_email, template, priority, dedupe_key) values (tests.pid('m1'), 'x@example.test', 'welcome', 0, 'both')$$, '23514', null, 'a notification needs exactly one of profile_id / to_email');
select throws_ok($$insert into public.notifications (template, priority, dedupe_key) values ('welcome', 0, 'none')$$, '23514', null, 'and not neither');
select throws_ok($$insert into public.notifications (profile_id, template, priority, dedupe_key) values (tests.pid('m1'), 'welcome', 0, 'dk-1')$$, '23505', null, 'dedupe_key is unique');

-- retry ---------------------------------------------------------------------------------------------------------------------------
insert into public.notifications (profile_id, template, priority, dedupe_key, status, attempts, last_error) values (tests.pid('m1'), 'welcome', 0, 'failed-1', 'failed', 5, 'mailbox_unavailable');
select tests.as_person('m1');
select throws_ok($$select app.retry_notification((select id from public.notifications where dedupe_key = 'failed-1'))$$, 'P0001', 'forbidden', 'only staff retry');
select tests.as_person('org');
select lives_ok($$select app.retry_notification((select id from public.notifications where dedupe_key = 'failed-1'))$$, 'staff put a failed message back in the queue');
select throws_ok($$select app.retry_notification((select id from public.notifications where dedupe_key = 'failed-1'))$$, 'P0001', 'conflict', 'a queued message cannot be retried');
select tests.as_owner();
select is(tests.val($$select status::text || ':' || attempts || ':' || coalesce(last_error, 'null') from public.notifications where dedupe_key = 'failed-1'$$), 'queued:0:null', 'with a fresh attempt count');

-- 24-hour reminders (cron) -----------------------------------------------------------------------------------------------------------
select tests.event('rem24', null, 'published', '24 hours');
select tests.event('rem-draft', null, 'draft', '24 hours'); select tests.event('rem-far', null, 'published', '5 days');
insert into public.event_registrations (event_id, profile_id, status) values
  (tests.eid('rem24'), tests.pid('m1'), 'going'), (tests.eid('rem24'), tests.pid('m2'), 'going'), (tests.eid('rem24'), tests.pid('m3'), 'waitlisted'),
  (tests.eid('rem-draft'), tests.pid('m1'), 'going'), (tests.eid('rem-far'), tests.pid('m1'), 'going');
select is(app.enqueue_due_reminders(), 2::integer, 'one reminder per person going to an event starting in about a day');
select is(app.enqueue_due_reminders(), 0::integer, 'exactly once');
select is(tests.count($$select 1 from public.notifications where template = 'reminder_24h' and profile_id = tests.pid('m3')$$), 0::bigint, 'waitlisted people and drafts/far events are ignored');
update public.events set starts_at = starts_at + interval '30 minutes', ends_at = ends_at + interval '30 minutes' where slug = 'rem24';
select is(app.enqueue_due_reminders(), 2::integer, 'a rescheduled event gets a fresh reminder (the dedupe key holds the start time)');

-- cron wiring ------------------------------------------------------------------------------------------------------------------------------
select lives_ok($$select app.cron_tick()$$, 'the cron tick runs even without Vault secrets (it only warns)');
select is(tests.val($$select count(*)::text from cron.job where jobname = 'hackum-tick' and schedule = '*/5 * * * *'$$), '1', 'pg_cron has the 5-minute job');
select ok(not has_function_privilege('authenticated', 'app.cron_tick()', 'execute') and not has_function_privilege('anon', 'app.ping_dispatch()', 'execute'), 'nobody but the owner can run the cron functions');

-- Clerk webhook helpers (service role) ------------------------------------------------------------------------------------------------------
select tests.profile('legacy2', 'member');
update public.profiles set clerk_user_id = null, email = 'old.member@example.test' where handle = 'legacy2';
select tests.as_person('m1');
select throws_ok($$select app.upsert_clerk_profile('user_x', 'x@example.test')$$, '42501', null, 'people cannot call the webhook helper');
select tests.as_service();
select is(app.upsert_clerk_profile('user_new1', 'Brand.New@Example.test', '{"mn":"Шинэ","en":"New"}', 'en', true), app.upsert_clerk_profile('user_new1', 'brand.new@example.test', null, 'mn', true), 'a new Clerk user gets a profile; the same id again is idempotent');
select is(app.upsert_clerk_profile('user_claim', 'OLD.member@example.test', null, 'mn', true), tests.pid('legacy2'), 'a matching unclaimed legacy profile is claimed by email');
select tests.as_owner();
select is(tests.val($$select clerk_user_id || ':' || status || ':' || handle from public.profiles where handle = 'legacy2'$$), 'user_claim:member:legacy2', 'it keeps its history (status member)');
select is(tests.val($$select status::text || ':' || coalesce(onboarded_at::text, 'not onboarded') || ':' || handle from public.profiles where clerk_user_id = 'user_new1'$$), 'guest:not onboarded:brand-new', 'new profiles are guests that still need onboarding, with a handle from the address');
select tests.as_service();
select throws_ok($$select app.upsert_clerk_profile('user_other', 'old.member@example.test', null, 'mn', true)$$, 'P0001', 'conflict', 'an address already claimed by another Clerk user conflicts');
select is(app.anonymize_clerk_user('user_new1'), true, 'user.deleted anonymises');
select tests.as_owner();
select is(tests.val($$select (deleted_at is not null)::text || ':' || coalesce(email::text, 'null') || ':' || coalesce(clerk_user_id, 'null') || ':' || (name ->> 'mn') from public.profiles where handle like 'deleted-%'$$), 'true:null:null:', 'no personal field survives');

select * from finish();
rollback;
