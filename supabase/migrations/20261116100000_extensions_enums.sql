-- 1/12 extensions, schemas, enums, shared domains.
-- Ids are uuid, times are timestamptz, email/handle are citext, bilingual text ({mn,en}) is the domain public.l_text.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions; -- gen_random_bytes for invite codes

-- `app` = rule functions + private settings (not directly readable by API roles). Default privileges are closed first so a
-- function created later is never executable by anon/authenticated until a migration grants it explicitly.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;
alter default privileges in schema app revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create type public.member_status as enum ('guest', 'member', 'alumni');
create type public.staff_role as enum ('organizer', 'admin');
create type public.event_kind as enum ('hackathon', 'workshop', 'meetup', 'competition', 'knowledge_day', 'outing', 'other');
create type public.event_mode as enum ('offline', 'online', 'hybrid');
create type public.event_audience as enum ('open', 'members', 'alumni', 'invite');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed', 'archived');
create type public.reg_status as enum ('applied', 'going', 'waitlisted', 'rejected', 'cancelled', 'attended', 'no_show');
create type public.reg_mode as enum ('rsvp', 'application');
create type public.reg_source as enum ('web', 'admin', 'import');
create type public.team_mode as enum ('none', 'optional', 'required');
create type public.school_scope as enum ('num', 'all');
create type public.visibility as enum ('public', 'members', 'private');
create type public.school_id as enum ('num', 'must', 'ufe', 'mnums', 'other');
create type public.major_track as enum ('software', 'cs', 'is', 'it', 'other');
create type public.term as enum ('autumn', 'spring');
create type public.application_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.notif_channel as enum ('email', 'push');
create type public.notif_status as enum ('queued', 'sending', 'sent', 'failed', 'skipped');
create type public.notif_template as enum (
  'welcome', 'rsvp_confirmed', 'waitlist_promoted', 'waitlist_notice', 'application_received', 'application_accepted',
  'application_rejected', 'membership_approved', 'membership_rejected', 'event_updated', 'event_cancelled',
  'reminder_24h', 'announcement', 'feedback_request', 'poll_opened'
);
create type public.inbox_kind as enum (
  'welcome', 'rsvp_confirmed', 'waitlist_promoted', 'waitlist_notice', 'application_received', 'application_accepted',
  'application_rejected', 'membership_approved', 'membership_rejected', 'event_updated', 'event_cancelled',
  'reminder_24h', 'announcement', 'feedback_request', 'poll_opened', 'staff_application', 'staff_failed_email'
);
create type public.poll_audience as enum ('members', 'community', 'everyone');
create type public.poll_results_visibility as enum ('after_vote', 'after_close', 'staff_only');
create type public.poll_status as enum ('draft', 'published', 'closed');

-- {mn, en}: Mongolian is the source language, English may be empty. Both keys must exist and be strings.
create domain public.l_text as jsonb
  check (value is null or (jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'mn') = 'string' and jsonb_typeof(value -> 'en') = 'string'));
