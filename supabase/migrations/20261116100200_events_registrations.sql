-- 3/12 events, registrations, teams.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  kind public.event_kind not null,
  title public.l_text not null,
  tagline public.l_text not null default '{"mn":"","en":""}',
  description public.l_text not null default '{"mn":"","en":""}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  tz text not null default 'Asia/Ulaanbaatar' check (tz = 'Asia/Ulaanbaatar'),
  approximate_date boolean not null default false,
  mode public.event_mode not null default 'offline',
  venue_name text,
  venue_address text,
  audience public.event_audience not null default 'open',
  school_scope public.school_scope not null default 'all',
  capacity integer check (capacity is null or capacity between 1 and 5000),
  waitlist boolean not null default true,
  reg_opens_at timestamptz,
  reg_closes_at timestamptz,
  status public.event_status not null default 'draft',
  cover_path text,
  poster_path text,
  themes text[] not null default '{}',
  external_url text,
  legacy_participants integer check (legacy_participants is null or legacy_participants >= 0),
  ics_sequence integer not null default 0 check (ics_sequence >= 0),
  reg_mode public.reg_mode not null default 'rsvp',
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 20),
  team_mode public.team_mode not null default 'none',
  team_size_min integer not null default 1,
  team_size_max integer not null default 1,
  decision_deadline timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (reg_closes_at is null or reg_closes_at <= starts_at),
  check (reg_opens_at is null or reg_closes_at is null or reg_opens_at <= reg_closes_at),
  check (reg_mode <> 'application' or decision_deadline is not null),
  check (team_mode = 'none' or (team_size_min >= 1 and team_size_min <= team_size_max and team_size_max <= 10))
);
create index events_status_starts_idx on public.events (status, starts_at desc);
create index events_starts_at_idx on public.events (starts_at desc);
create index events_created_by_idx on public.events (created_by);
create index events_created_at_idx on public.events (created_at desc);

-- The online meeting link is only for people holding a seat and staff, so it cannot live in the publicly readable events row.
create table public.event_online_links (
  event_id uuid primary key references public.events (id) on delete cascade,
  online_url text not null check (online_url ~ '^https://')
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (length(name) between 2 and 40),
  invite_code text not null unique,
  captain_profile_id uuid not null references public.profiles (id) on delete cascade,
  looking_for text[] not null default '{}',
  locked boolean not null default false
);
create unique index teams_event_name_idx on public.teams (event_id, lower(name));
create index teams_captain_idx on public.teams (captain_profile_id);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.reg_status not null,
  source public.reg_source not null default 'web',
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  team_id uuid references public.teams (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_notified_at timestamptz,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (event_id, profile_id)
);
create index event_registrations_profile_idx on public.event_registrations (profile_id);
create index event_registrations_event_status_idx on public.event_registrations (event_id, status);
create index event_registrations_team_idx on public.event_registrations (team_id) where team_id is not null;
create index event_registrations_decided_by_idx on public.event_registrations (decided_by);
create index event_registrations_created_at_idx on public.event_registrations (created_at desc);
create index event_registrations_status_idx on public.event_registrations (status);
