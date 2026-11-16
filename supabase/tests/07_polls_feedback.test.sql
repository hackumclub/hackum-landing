begin;
select plan(73);
select tests.use_issuer();

select tests.profile('m1', 'member'); select tests.profile('m2', 'member'); select tests.profile('guest1');
select tests.profile('alum', 'alumni'); select tests.profile('quiet', 'member');
update public.profiles set notif_prefs = '{"reminders":true,"updates":true,"announcements":false}' where handle = 'quiet';
select tests.staff('org', 'organizer');

create function pg_temp.pi(p_over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('title', jsonb_build_object('mn', 'Санал', 'en', 'Poll'), 'description', jsonb_build_object('mn', '', 'en', ''),
    'options', jsonb_build_array(jsonb_build_object('id', 'a', 'label', jsonb_build_object('mn', 'А', 'en', 'A')), jsonb_build_object('id', 'b', 'label', jsonb_build_object('mn', 'Б', 'en', 'B')),
      jsonb_build_object('id', 'c', 'label', jsonb_build_object('mn', 'В', 'en', 'C'))),
    'multi', false, 'max_choices', 1, 'audience', 'members', 'anonymous', false, 'results', 'after_vote') || p_over
$$;
grant execute on function pg_temp.pi(jsonb) to public;

-- creating and publishing -----------------------------------------------------------------------------------------------
select tests.as_person('m1');
select throws_ok($$select app.create_poll(pg_temp.pi())$$, 'P0001', 'forbidden', 'only staff create polls');
select tests.as_person('org');
select lives_ok($$select app.create_poll(pg_temp.pi())$$, 'staff create a poll');
select tests.as_owner();
select is(tests.val($$select status::text from public.polls$$), 'draft', 'it starts as a draft');
select tests.as_person('org');
select throws_ok(format($f$select app.create_poll(pg_temp.pi(%L))$f$, o), 'P0001', 'invalid', 'rejects ' || d)
from (values
  ('{"title":{"mn":" ","en":""}}', 'a blank title'),
  ('{"options":[{"id":"a","label":{"mn":"А","en":""}}]}', 'a single option'),
  ('{"options":[{"id":"a","label":{"mn":"А","en":""}},{"id":"a","label":{"mn":"Б","en":""}}]}', 'duplicate option ids'),
  ('{"options":[{"id":"A!","label":{"mn":"А","en":""}},{"id":"b","label":{"mn":"Б","en":""}}]}', 'a bad option id'),
  ('{"multi":true,"max_choices":4}', 'max_choices above the number of options'),
  ('{"multi":false,"max_choices":2}', 'max_choices 2 on a single-choice poll'),
  ('{"audience":"nobody"}', 'an unknown audience'),
  ('{"opens_at":"2030-01-02T00:00:00Z","closes_at":"2030-01-01T00:00:00Z"}', 'closing before opening')
) v(o, d);
select tests.as_owner();
select is(tests.count($$select 1 from public.polls$$), 1::bigint, 'invalid polls create nothing');
select tests.as_person('org');
select lives_ok($$select app.set_poll_status(tests.poll('Санал'), 'published')$$, 'staff publish');
select tests.as_owner();
select is(tests.count($$select 1 from public.notifications where template = 'poll_opened'$$), 3::bigint, 'the audience (members incl. staff, minus the opted-out one) is mailed once');
select is(tests.count($$select 1 from public.inbox where kind = 'poll_opened'$$), 3::bigint, 'and gets an in-app item');
select tests.as_person('org');
select app.set_poll_status(tests.poll('Санал'), 'closed');
select is((select app.set_poll_status(tests.poll('Санал'), 'published') ->> 'notified'), '0', 're-opening never mails anyone twice');
select throws_ok($$select app.set_poll_status(tests.poll('Санал'), 'published')$$, 'P0001', 'conflict', 'publishing a published poll is a conflict');

-- voting ----------------------------------------------------------------------------------------------------------------
select tests.as_person('m1');
select lives_ok($$select app.vote(tests.poll('Санал'), array['a'])$$, 'an eligible member votes');
select lives_ok($$select app.vote(tests.poll('Санал'), array['b'])$$, 'and changes their mind');
select is((select option_ids from public.poll_votes), array['b'], 'one vote per person, the newest wins');
select throws_ok($$select app.vote(tests.poll('Санал'), array['a', 'b'])$$, 'P0001', 'invalid', 'a single-choice poll takes one option');
select throws_ok($$select app.vote(tests.poll('Санал'), array['zzz'])$$, 'P0001', 'invalid', 'unknown options are invalid');
select throws_ok($$select app.vote(tests.poll('Санал'), array[]::text[])$$, 'P0001', 'invalid', 'an empty ballot is invalid');
select tests.as_person('guest1');
select throws_ok($$select app.vote(tests.poll('Санал'), array['a'])$$, 'P0001', 'forbidden', 'a guest is outside a members poll');
select tests.as_person('alum');
select throws_ok($$select app.vote(tests.poll('Санал'), array['a'])$$, 'P0001', 'forbidden', 'an alumnus is outside a members poll');
select tests.as_anon();
select throws_ok($$select app.vote(gen_random_uuid(), array['a'])$$, '42501', null, 'anonymous visitors cannot vote');
select tests.as_owner();
select is(tests.count($$select 1 from public.poll_votes$$), 1::bigint, 'ineligible attempts wrote nothing');
-- multi-choice, community audience, timing
select tests.as_person('org');
select app.create_poll(pg_temp.pi('{"title":{"mn":"Олон","en":"Many"},"multi":true,"max_choices":2,"audience":"community","results":"after_close"}'));
select app.set_poll_status(tests.poll('Олон'), 'published');
select tests.as_person('alum');
select lives_ok($$select app.vote(tests.poll('Олон'), array['a', 'c'])$$, 'a multi-choice poll takes up to max_choices');
select throws_ok($$select app.vote(tests.poll('Олон'), array['a', 'b', 'c'])$$, 'P0001', 'invalid', 'but not more');
select tests.as_owner();
insert into public.polls (title, options, status, opens_at, closes_at) values
  ('{"mn":"Удахгүй","en":"soon"}', '[{"id":"a","label":{"mn":"А","en":""}},{"id":"b","label":{"mn":"Б","en":""}}]', 'published', now() + interval '1 day', null),
  ('{"mn":"Дууссан","en":"over"}', '[{"id":"a","label":{"mn":"А","en":""}},{"id":"b","label":{"mn":"Б","en":""}}]', 'published', null, now() - interval '1 hour'),
  ('{"mn":"Ноорог","en":"draft"}', '[{"id":"a","label":{"mn":"А","en":""}},{"id":"b","label":{"mn":"Б","en":""}}]', 'draft', null, null);
select tests.as_person('m1');
select throws_ok($$select app.vote(tests.poll('soon'), array['a'])$$, 'P0001', 'closed', 'closed before it opens');
select throws_ok($$select app.vote(tests.poll('over'), array['a'])$$, 'P0001', 'closed', 'closed after it closes');
select throws_ok($$select app.vote(tests.poll('draft'), array['a'])$$, 'P0001', 'not_found', 'a draft does not exist for voters');

-- ballot frozen once people voted ----------------------------------------------------------------------------------------
select tests.as_person('org');
select throws_ok($$select app.update_poll(tests.poll('Санал'), pg_temp.pi('{"options":[{"id":"a","label":{"mn":"А","en":""}},{"id":"z","label":{"mn":"Я","en":""}}]}'))$$, 'P0001', 'conflict', 'options are frozen once people voted');
select lives_ok($$select app.update_poll(tests.poll('Санал'), pg_temp.pi('{"title":{"mn":"Шинэ нэр","en":"New"}}'))$$, 'but staff can still retitle');
select throws_ok($$select app.set_poll_status(tests.poll('Шинэ нэр'), 'draft')$$, 'P0001', 'conflict', 'and a poll with votes cannot go back to draft');

-- results ---------------------------------------------------------------------------------------------------------------------
select tests.as_person('m2');
select is((select app.poll_tallies(tests.poll('Шинэ нэр')) ->> 'visible'), 'false', 'after_vote: hidden until you vote');
select app.vote(tests.poll('Шинэ нэр'), array['a']);
select is((select app.poll_tallies(tests.poll('Шинэ нэр')) #>> '{tallies,0,votes}'), '1', 'after voting the tallies show');
select is((select app.poll_tallies(tests.poll('Шинэ нэр')) ->> 'eligible'), '4', 'turnout counts the audience (4 members: two voters, the quiet one and the organizer)');
select is((select app.poll_tallies(tests.poll('Шинэ нэр')) -> 'voter_list'), 'null'::jsonb, 'voter names are for staff only');
select tests.as_person('alum');
select is((select app.poll_tallies(tests.poll('Олон')) ->> 'visible'), 'false', 'after_close: hidden while open, even after voting');
select tests.as_person('guest1');
select throws_ok($$select app.poll_tallies(tests.poll('Шинэ нэр'))$$, 'P0001', 'forbidden', 'people outside the audience get no results');
select tests.as_person('org');
select is((select app.poll_tallies(tests.poll('Шинэ нэр')) -> 'voter_list' -> 0 ->> 'profile_id') is not null, true, 'staff see voters on a named poll');
select is((select app.poll_tallies(tests.poll('Олон')) ->> 'visible'), 'true', 'staff always see tallies');
select tests.as_owner();
update public.polls set anonymous = true where title ->> 'en' = 'Many';
select tests.as_person('org');
select is((select app.poll_tallies(tests.poll('Олон')) -> 'voter_list'), 'null'::jsonb, 'an anonymous poll never lists voters');
select is((select count(*) from public.poll_votes where poll_id = tests.poll('Олон')), 0::bigint, 'and staff cannot read its votes directly either');

-- feedback ----------------------------------------------------------------------------------------------------------------------
select tests.as_owner();
select tests.profile('att'); select tests.profile('goer'); select tests.profile('noshow'); select tests.profile('stranger'); select tests.profile('late2');
select tests.event('past-ev', null, 'completed', '-3 hours');
select tests.event('old-ev', null, 'completed', '-400 hours');
select tests.event('live-ev', null, 'published', '1 day');
insert into public.event_registrations (event_id, profile_id, status) values
  (tests.eid('past-ev'), tests.pid('att'), 'attended'), (tests.eid('past-ev'), tests.pid('goer'), 'going'), (tests.eid('past-ev'), tests.pid('noshow'), 'no_show'),
  (tests.eid('old-ev'), tests.pid('late2'), 'attended'), (tests.eid('live-ev'), tests.pid('att'), 'going');
select tests.as_person('att');
select lives_ok($$select app.submit_feedback(tests.eid('past-ev'), 5, 10, 'Гоё', 'Дуу чимээ', false)$$, 'an attendee gives feedback');
select tests.as_person('goer');
select lives_ok($$select app.submit_feedback(tests.eid('past-ev'), 3, 6, '', 'Орц', true)$$, 'so does someone marked going');
select tests.as_person('noshow');
select throws_ok($$select app.submit_feedback(tests.eid('past-ev'), 5, 10, '', '', false)$$, 'P0001', 'forbidden', 'a no-show is refused');
select tests.as_person('stranger');
select throws_ok($$select app.submit_feedback(tests.eid('past-ev'), 5, 10, '', '', false)$$, 'P0001', 'forbidden', 'a stranger is refused');
select tests.as_person('att');
select throws_ok($$select app.submit_feedback(tests.eid('live-ev'), 5, 10, '', '', false)$$, 'P0001', 'closed', 'an event that is not completed is closed');
select throws_ok($$select app.submit_feedback(gen_random_uuid(), 5, 10, '', '', false)$$, 'P0001', 'not_found', 'an unknown event is not_found');
select tests.as_person('late2');
select throws_ok($$select app.submit_feedback(tests.eid('old-ev'), 5, 10, '', '', false)$$, 'P0001', 'closed', 'the window is 14 days after the event ended');
select tests.as_person('att');
select throws_ok(format($f$select app.submit_feedback(tests.eid('past-ev'), %s, %s, %L, '', false)$f$, r, n, t), 'P0001', 'invalid', 'feedback rejects ' || d)
from (values (0, 5, '', 'rating 0'), (6, 5, '', 'rating 6'), (3, -1, '', 'nps -1'), (3, 11, '', 'nps 11'), (3, 5, repeat('x', 1001), 'a 1001-char comment')) v(r, n, t, d);
select app.submit_feedback(tests.eid('past-ev'), 4, 9, 'Шинэчилсэн', '', false);
select tests.as_owner();
select is(tests.val($$select count(*) || ':' || max(rating) from public.event_feedback where event_id = tests.eid('past-ev') and profile_id = tests.pid('att')$$), '1:4', 'editing keeps one row per person');
select tests.as_person('org');
select is((select app.feedback_summary(tests.eid('past-ev')) ->> 'n'), '2', 'the summary counts answers');
select is((select app.feedback_summary(tests.eid('past-ev')) ->> 'avg_rating'), '3.5', 'average rating');
select is((select app.feedback_summary(tests.eid('past-ev')) ->> 'nps'), '0', 'NPS = promoters - detractors as a percentage (1 - 1)');
select is((select app.feedback_summary(tests.eid('past-ev')) -> 'distribution'), '[0, 0, 1, 1, 0]'::jsonb, 'distribution of ratings 1..5');
select is((select app.feedback_summary(tests.eid('past-ev')) ->> 'eligible'), '2', 'eligible = attended + going');
select is((select app.feedback_summary(tests.eid('past-ev')) ->> 'response_rate'), '1', 'response rate');
select is((select count(*) from jsonb_array_elements(app.feedback_summary(tests.eid('past-ev')) -> 'comments') c where c ->> 'kind' = 'improve' and c -> 'author' = 'null'::jsonb), 1::bigint, 'an anonymous comment has no author');
select is((select count(*) from jsonb_array_elements(app.feedback_summary(tests.eid('past-ev')) -> 'comments') c where c -> 'author' ->> 'mn' like 'Нэр att'), 1::bigint, 'a named comment carries the author');
select is((select app.feedback_summary(tests.eid('live-ev')) ->> 'avg_rating'), null, 'no answers: null average, never 0');
select tests.as_person('att');
select throws_ok($$select app.feedback_summary(tests.eid('past-ev'))$$, 'P0001', 'forbidden', 'only staff read the summary');

-- feedback requests (cron) --------------------------------------------------------------------------------------------------------
select tests.as_owner();
select is(app.enqueue_feedback_requests(now()), 0::integer, 'nobody is asked who already answered or never came');
select tests.profile('shy');
insert into public.event_registrations (event_id, profile_id, status) values (tests.eid('past-ev'), tests.pid('shy'), 'attended');
select is(app.enqueue_feedback_requests(now()), 1::integer, 'an attendee who has not answered is asked once, an hour after the event');
select is(app.enqueue_feedback_requests(now()), 0::integer, 'and only once');
select is(app.enqueue_feedback_requests(now() - interval '2 hours'), 0::integer, 'not before the hour has passed');
select is(app.enqueue_feedback_requests(now() + interval '15 days'), 0::integer, 'and not after the 14-day window');

select * from finish();
rollback;
