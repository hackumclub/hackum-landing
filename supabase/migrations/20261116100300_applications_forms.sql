-- 4/12 membership applications, site forms, join submissions.

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season integer not null references public.seasons (year),
  motivation text not null check (length(motivation) between 1 and 1000),
  team_interest text[] not null default '{}' check (cardinality(team_interest) <= 6),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,                                             -- staff-only: never selectable by the applicant
  created_at timestamptz not null default now(),
  unique (profile_id, season)
);
create index membership_applications_status_idx on public.membership_applications (status, created_at desc);
create index membership_applications_season_idx on public.membership_applications (season);
create index membership_applications_reviewed_by_idx on public.membership_applications (reviewed_by);

-- Site-level forms staff edit under Forms (an event's own questions live on the event).
create table public.forms (
  id text primary key check (id in ('membership_application', 'join')),
  kind text not null check (kind in ('membership_application', 'join')),
  title public.l_text not null,
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (id = kind)
);
create index forms_updated_by_idx on public.forms (updated_by);
create trigger forms_touch before update on public.forms for each row execute function app.touch_updated_at();

insert into public.forms (id, kind, title, questions) values
  ('membership_application', 'membership_application', '{"mn":"Гишүүнчлэлийн өргөдөл","en":"Membership application"}', '[]'),
  ('join', 'join', '{"mn":"Hackum-д нэгдэх","en":"Join Hackum"}', '[]');

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id text not null default 'join' check (form_id = 'join') references public.forms (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  unique (form_id, profile_id)                                  -- one submission per person, the newest wins
);
create index form_submissions_profile_idx on public.form_submissions (profile_id);
create index form_submissions_created_at_idx on public.form_submissions (created_at desc);
