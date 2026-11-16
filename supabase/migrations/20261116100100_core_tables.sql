-- 2/12 profiles, staff roles, seasons, memberships, private settings.

create function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Private key/value settings (never exposed: no grants, RLS on, no policies). Keys: `clerk_issuer`.
create table app.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app.settings enable row level security;
create trigger settings_touch before update on app.settings for each row execute function app.touch_updated_at();

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,                                   -- Clerk `sub`; null = unclaimed legacy profile
  email extensions.citext unique,
  handle extensions.citext not null unique check (length(handle::text) between 1 and 80),
  name public.l_text not null default '{"mn":"","en":""}' check (length(name ->> 'mn') <= 80 and length(name ->> 'en') <= 80),
  avatar_path text,                                            -- Storage object path inside bucket `avatars`
  school text check (school is null or length(school) <= 80), -- display text
  school_id public.school_id,                                  -- drives eligibility: only 'num' can become a member
  major text check (major is null or length(major) <= 80),
  major_track public.major_track,
  program_index text check (program_index is null or length(program_index) <= 20),
  grad_year integer check (grad_year is null or grad_year between 2000 and 2040),
  status public.member_status not null default 'guest',
  visibility public.visibility not null default 'members',
  locale text not null default 'mn' check (locale in ('mn', 'en')),
  links jsonb not null default '{}' check (jsonb_typeof(links) = 'object' and octet_length(links::text) <= 1500),
  notif_prefs jsonb not null default '{"reminders":true,"updates":true,"announcements":true}'
    check (jsonb_typeof(notif_prefs) = 'object' and notif_prefs ?& array['reminders', 'updates', 'announcements']),
  calendar_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  deleted_at timestamptz
);
create index profiles_status_idx on public.profiles (status) where deleted_at is null;
create index profiles_created_at_idx on public.profiles (created_at desc);
create index profiles_visibility_idx on public.profiles (visibility) where deleted_at is null;
create index profiles_last_seen_idx on public.profiles (last_seen_at desc nulls last);

create table public.staff_roles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);
create index staff_roles_role_idx on public.staff_roles (role);
create index staff_roles_granted_by_idx on public.staff_roles (granted_by);

create table public.seasons (
  year integer primary key check (year between 2000 and 2100),
  label public.l_text not null,
  application_opens_at timestamptz,
  application_closes_at timestamptz,
  is_current boolean not null default false,
  check (application_opens_at is null or application_closes_at is null or application_opens_at < application_closes_at)
);
create unique index seasons_one_current_idx on public.seasons (is_current) where is_current;
create index seasons_window_idx on public.seasons (application_opens_at, application_closes_at);

create table public.memberships (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season integer not null check (season between 2000 and 2100),  -- history seasons need no seasons row
  team text,
  role_title public.l_text,
  primary key (profile_id, season)
);
create index memberships_season_idx on public.memberships (season);

create table public.profile_semesters (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  term public.term not null,
  subjects text[] not null default '{}' check (cardinality(subjects) <= 12),
  shared boolean not null default false,
  primary key (profile_id, year, term)
);
