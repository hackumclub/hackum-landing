-- 5/12 outbox, inbox, subscribers, suppressions, usage, audit, timeline.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  to_email extensions.citext,
  channel public.notif_channel not null default 'email',
  template public.notif_template not null,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  priority smallint not null check (priority in (0, 1, 2)),     -- 0 transactional, 1 reminder, 2 announcement
  scheduled_at timestamptz not null default now(),
  status public.notif_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  dedupe_key text not null unique,
  sent_at timestamptz,
  check (num_nonnulls(profile_id, to_email) = 1)                -- exactly one of profile_id / to_email
);
create index notifications_due_idx on public.notifications (priority, scheduled_at) where status = 'queued';
create index notifications_status_idx on public.notifications (status, scheduled_at desc);
create index notifications_profile_idx on public.notifications (profile_id);
create index notifications_template_idx on public.notifications (template);
create index notifications_event_idx on public.notifications ((payload ->> 'event_id')) where template = 'reminder_24h';

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.inbox_kind not null,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dedupe_key text not null unique
);
create index inbox_profile_created_idx on public.inbox (profile_id, created_at desc, id desc);
create index inbox_unread_idx on public.inbox (profile_id) where read_at is null;

create table public.email_daily_usage (
  day date primary key,
  sent integer not null default 0 check (sent >= 0)
);

create table public.email_suppressions (
  email extensions.citext primary key,
  reason text not null,
  at timestamptz not null default now()
);

create table public.subscribers (
  email extensions.citext primary key,
  name text not null check (length(name) between 1 and 80),
  lang text not null default 'mn' check (lang in ('mn', 'en')),
  source text not null default 'join_page' check (source in ('join_page', 'footer', 'event_page', 'import')),
  created_at timestamptz not null default now()
);
create index subscribers_created_at_idx on public.subscribers (created_at desc);

create table public.timeline_milestones (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2000 and 2100),
  title public.l_text not null,
  note public.l_text,
  url text,
  front_path text,
  back_path text,
  sort integer not null default 0
);
create index timeline_milestones_year_sort_idx on public.timeline_milestones (year, sort);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text not null,
  diff jsonb not null default '{}',
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_actor_idx on public.audit_log (actor_profile_id, at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_action_idx on public.audit_log (action, at desc);
