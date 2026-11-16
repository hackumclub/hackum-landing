-- 6/12 polls and event feedback.

create table public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  nps smallint not null check (nps between 0 and 10),
  went_well text not null default '' check (length(went_well) <= 1000),
  improve text not null default '' check (length(improve) <= 1000),
  anonymous boolean not null default false,                     -- hides the author from staff views; the row still dedupes by person
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);
create index event_feedback_profile_idx on public.event_feedback (profile_id);
create index event_feedback_created_at_idx on public.event_feedback (created_at desc);
create trigger event_feedback_touch before update on public.event_feedback for each row execute function app.touch_updated_at();

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  title public.l_text not null,
  description public.l_text not null default '{"mn":"","en":""}',
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  multi boolean not null default false,
  max_choices integer not null default 1 check (max_choices >= 1),
  audience public.poll_audience not null default 'members',
  anonymous boolean not null default false,
  results public.poll_results_visibility not null default 'after_vote',
  opens_at timestamptz,
  closes_at timestamptz,
  status public.poll_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (multi or max_choices = 1),
  check (opens_at is null or closes_at is null or closes_at > opens_at)
);
create index polls_status_idx on public.polls (status, created_at desc);
create index polls_created_by_idx on public.polls (created_by);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  option_ids text[] not null check (cardinality(option_ids) between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, profile_id)                             -- one vote per poll and person
);
create index poll_votes_profile_idx on public.poll_votes (profile_id);
create trigger poll_votes_touch before update on public.poll_votes for each row execute function app.touch_updated_at();
