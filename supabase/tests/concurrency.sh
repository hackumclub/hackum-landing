#!/usr/bin/env bash
# Real concurrency check for the capacity lock (not part of `supabase test db`: it needs committed data and parallel sessions).
# Usage: supabase/tests/concurrency.sh [people=20] [capacity=5]     Requires `supabase start`. Cleans up after itself.
set -euo pipefail
N="${1:-20}"; CAP="${2:-5}"
DB=$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_')
psql_() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
trap 'psql_ -c "delete from public.events where slug = '"'"'race-test'"'"'; delete from public.profiles where handle like '"'"'race-%'"'"'; delete from app.settings where key = '"'"'clerk_issuer'"'"' and value = '"'"'https://race.test'"'"';" >/dev/null' EXIT

psql_ <<SQL
insert into app.settings (key, value) values ('clerk_issuer', 'https://race.test') on conflict (key) do update set value = excluded.value;
insert into public.profiles (handle, clerk_user_id, email, name, school_id, onboarded_at)
  select 'race-' || i, 'user_race_' || i, 'race' || i || '@example.test', '{"mn":"R","en":"R"}', 'num', now() from generate_series(1, $N) i;
insert into public.events (slug, kind, title, starts_at, ends_at, status, capacity)
  values ('race-test', 'workshop', '{"mn":"Race","en":"Race"}', now() + interval '3 days', now() + interval '3 days 2 hours', 'published', $CAP);
SQL
EVENT=$(psql_ -c "select id from public.events where slug = 'race-test'")
for i in $(seq 1 "$N"); do
  psql_ <<SQL &
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_race_$i","iss":"https://race.test","role":"authenticated"}';
select pg_sleep(0.2);
select app.register_for_event('$EVENT');
commit;
SQL
done
wait
RESULT=$(psql_ -c "select count(*) filter (where status = 'going') || ' going, ' || count(*) filter (where status = 'waitlisted') || ' waitlisted, ' || count(*) || ' total' from public.event_registrations where event_id = '$EVENT'")
echo "capacity $CAP, $N concurrent registrations -> $RESULT"
GOING=$(psql_ -c "select count(*) from public.event_registrations where event_id = '$EVENT' and status = 'going'")
[ "$GOING" -eq "$CAP" ] || { echo "FAIL: going ($GOING) != capacity ($CAP)"; exit 1; }
echo OK
