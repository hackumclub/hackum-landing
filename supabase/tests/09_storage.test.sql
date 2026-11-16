begin;
select plan(18);
select tests.use_issuer();

select tests.profile('alice'); select tests.profile('bob'); select tests.staff('org', 'organizer');

-- avatars: a person writes only the object named after their own profile id
select tests.as_person('alice');
select lives_ok(format($f$insert into storage.objects (bucket_id, name) values ('avatars', %L)$f$, tests.pid('alice')::text), 'a person writes avatars/<their profile id>');
select lives_ok(format($f$insert into storage.objects (bucket_id, name) values ('avatars', %L)$f$, tests.pid('alice')::text || '/v2.webp'), 'or an object under their id folder');
select throws_ok(format($f$insert into storage.objects (bucket_id, name) values ('avatars', %L)$f$, tests.pid('bob')::text), '42501', null, 'but not another person''s object');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'anything')$$, '42501', null, 'nor an arbitrary name');
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 2::bigint, 'the owner reads their own avatar objects');
select tests.as_person('bob');
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 0::bigint, 'another person cannot read it (the app serves it by signed URL)');
select tests.as_person('org');
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 2::bigint, 'staff can read avatars');
select tests.as_anon();
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 0::bigint, 'anon cannot');
select throws_ok(format($f$insert into storage.objects (bucket_id, name) values ('avatars', %L)$f$, tests.pid('alice')::text || '/anon'), '42501', null, 'anon cannot write');

-- posters: staff write
select tests.as_person('alice');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('posters', 'events/x.webp')$$, '42501', null, 'a person cannot write posters');
select tests.as_person('org');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('posters', 'events/x.webp')$$, 'staff write posters');
select lives_ok($$update storage.objects set name = 'events/y.webp' where bucket_id = 'posters' and name = 'events/x.webp'$$, 'and replace them (select + update policies)');
select tests.as_person('alice');
select is((select count(*) from storage.objects where bucket_id = 'posters'), 0::bigint, 'listing posters through the API needs staff (public bucket reads use the public URL)');

-- private-docs: staff only for now
select tests.as_person('org');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('private-docs', 'rules.pdf')$$, 'staff write private-docs');
select tests.as_person('alice');
select is((select count(*) from storage.objects where bucket_id = 'private-docs'), 0::bigint, 'a person cannot read private-docs');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('private-docs', 'mine.pdf')$$, '42501', null, 'nor write it');

-- the issuer pin applies to storage as well
select tests.as_person('org', 'https://evil.example.test');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('posters', 'events/evil.webp')$$, '42501', null, 'a token from another issuer cannot write posters');
select tests.as_person('alice', 'https://evil.example.test');
select throws_ok(format($f$insert into storage.objects (bucket_id, name) values ('avatars', %L)$f$, tests.pid('alice')::text || '/evil'), '42501', null, 'nor avatars');

select * from finish();
rollback;
