-- 13/15 row-level security on EVERY table, the Clerk issuer pin, table grants, views, execute grants.
--
-- Model: the JWT `sub` is a Clerk user id (text). app.current_profile_id() maps it to a profile; roles come from staff_roles.
-- Nobody gets direct INSERT/UPDATE/DELETE on rule-governed tables (registrations, applications, feedback, votes, inbox,
-- notifications, events, polls, ...): they are written only by the security definer functions in schema app.
-- (FORCE ROW LEVEL SECURITY is not used: the table owner `postgres` has BYPASSRLS on Supabase, so it would change nothing.)

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'staff_roles', 'seasons', 'memberships', 'profile_semesters', 'events', 'event_online_links', 'teams', 'event_registrations',
    'membership_applications', 'forms', 'form_submissions', 'notifications', 'inbox', 'email_daily_usage', 'email_suppressions', 'subscribers',
    'timeline_milestones', 'audit_log', 'event_feedback', 'polls', 'poll_votes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Restrictive: on top of whatever a permissive policy allows, a signed-in token must come from the configured Clerk issuer.
    execute format('create policy issuer_pin on public.%I as restrictive for all to authenticated using ((select app.jwt_issuer_ok())) with check ((select app.jwt_issuer_ok()))', t);
  end loop;
end $$;

-- ── policies (all permissive, per command; see spec §4 "RLS summary") ─────────────────────────────────────────────────

-- profiles: own row or staff, read only. Other people's profiles are reached through the views below (safe columns only: no
-- email, no calendar token). Nobody updates profiles directly: every write goes through update_profile / update_prefs /
-- update_academic / complete_onboarding / set_avatar_path, which validate.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select app.current_profile_id()) or (select app.is_staff()));

create policy staff_roles_select on public.staff_roles for select to authenticated
  using (profile_id = (select app.current_profile_id()) or (select app.is_staff()));

create policy seasons_select on public.seasons for select to anon, authenticated using (true);

create policy memberships_select on public.memberships for select to anon, authenticated
  using (profile_id = (select app.current_profile_id()) or (select app.is_staff()) or profile_id in (select app.visible_profile_ids()));

create policy profile_semesters_select on public.profile_semesters for select to authenticated
  using (profile_id = (select app.current_profile_id()) or (select app.is_staff()) or (shared and profile_id in (select app.visible_profile_ids())));

-- events: anon sees published / completed / archived. Signed-in people also see a cancelled event they registered for; staff see all.
create policy events_select_public on public.events for select to anon
  using (status in ('published', 'completed', 'archived'));
create policy events_select_auth on public.events for select to authenticated
  using (status in ('published', 'completed', 'archived') or (select app.is_staff()) or (status = 'cancelled' and app.has_registration(id)));

create policy event_online_links_select on public.event_online_links for select to authenticated
  using ((select app.is_staff()) or app.is_seated(event_id));

create policy teams_select on public.teams for select to authenticated
  using ((select app.is_staff()) or id in (select app.my_team_ids()));

create policy event_registrations_select on public.event_registrations for select to authenticated
  using (profile_id = (select app.current_profile_id()) or (select app.is_staff()));

-- Staff only (carries review_note); the applicant reads their own through the view my_membership_applications.
create policy membership_applications_select on public.membership_applications for select to authenticated
  using ((select app.is_staff()));

create policy forms_select on public.forms for select to anon, authenticated using (true);

create policy form_submissions_select on public.form_submissions for select to authenticated
  using (profile_id = (select app.current_profile_id()) or (select app.is_staff()));

create policy notifications_select on public.notifications for select to authenticated using ((select app.is_staff()));
create policy inbox_select on public.inbox for select to authenticated using (profile_id = (select app.current_profile_id()));
create policy email_daily_usage_select on public.email_daily_usage for select to authenticated using ((select app.is_staff()));
create policy email_suppressions_select on public.email_suppressions for select to authenticated using ((select app.is_staff()));
create policy subscribers_select on public.subscribers for select to authenticated using ((select app.is_staff()));

create policy timeline_select on public.timeline_milestones for select to anon, authenticated using (true);
create policy timeline_insert on public.timeline_milestones for insert to authenticated with check ((select app.is_staff()));
create policy timeline_update on public.timeline_milestones for update to authenticated using ((select app.is_staff())) with check ((select app.is_staff()));
create policy timeline_delete on public.timeline_milestones for delete to authenticated using ((select app.is_staff()));

create policy audit_log_select on public.audit_log for select to authenticated using ((select app.is_admin()));

-- Own answer only. Staff read aggregates through app.feedback_summary, which hides authors of anonymous answers.
create policy event_feedback_select on public.event_feedback for select to authenticated using (profile_id = (select app.current_profile_id()));

create policy polls_select on public.polls for select to authenticated
  using ((select app.is_staff()) or (status <> 'draft' and app.poll_eligible_me(audience)));
-- Staff see who voted only on polls that are not anonymous.
create policy poll_votes_select on public.poll_votes for select to authenticated
  using (profile_id = (select app.current_profile_id()) or poll_id in (select app.staff_votable_poll_ids()));

-- Staff edits to the timeline go straight to the table, so a trigger writes the audit row (all other staff actions audit in their function).
create function app.audit_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.audit('timeline.' || lower(tg_op), 'timeline_milestones', coalesce(new.id, old.id)::text);
  return coalesce(new, old);
end $$;
create trigger timeline_audit after insert or update or delete on public.timeline_milestones for each row execute function app.audit_timeline();

-- ── views (owner-privileged on purpose: they expose a fixed set of safe columns and carry their own WHERE) ──────────────

create view public.public_profiles with (security_invoker = false) as
  select p.id, p.handle, p.name, p.avatar_path, p.school, p.status
  from public.profiles p
  where p.visibility = 'public' and p.deleted_at is null;

-- People who chose "members" or "public" visibility, for signed-in people only (the issuer pin lives in current_profile_id).
create view public.member_profiles with (security_invoker = false) as
  select p.id, p.handle, p.name, p.avatar_path, p.school, p.school_id, p.major, p.major_track, p.grad_year, p.status, p.links
  from public.profiles p
  where p.visibility in ('public', 'members') and p.deleted_at is null and app.current_profile_id() is not null;

-- The applicant's own applications, without the staff-only review note and reviewer.
create view public.my_membership_applications with (security_invoker = false) as
  select a.id, a.profile_id, a.season, a.motivation, a.team_interest, a.answers, a.status, a.reviewed_at, a.created_at
  from public.membership_applications a
  where a.profile_id = app.current_profile_id();

-- ── table privileges (RLS decides which rows; these decide which operations/columns exist at all) ───────────────────────

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.seasons, public.events, public.forms, public.timeline_milestones, public.memberships to anon;
grant select on public.public_profiles to anon, authenticated;
grant select on public.member_profiles, public.my_membership_applications to authenticated;

grant select on public.profiles, public.staff_roles, public.seasons, public.memberships, public.profile_semesters, public.events,
  public.event_online_links, public.teams, public.event_registrations, public.membership_applications, public.forms, public.form_submissions,
  public.notifications, public.inbox, public.email_daily_usage, public.email_suppressions, public.subscribers, public.timeline_milestones,
  public.audit_log, public.event_feedback, public.polls, public.poll_votes to authenticated;
grant insert, update, delete on public.timeline_milestones to authenticated;
-- No UPDATE grant on profiles at all: the validated RPCs are the only write path.

-- ── function privileges: closed by default, opened one by one ──────────────────────────────────────────────────────────

revoke execute on all functions in schema app from public, anon, authenticated;

-- Used by the policies above (evaluated as the calling role).
-- None takes a profile id: each answers only about the caller (is_seated / has_registration), or returns a fixed set (visible_profile_ids,
-- staff_votable_poll_ids, my_team_ids), so none can be used to probe someone else.
grant execute on function app.jwt_issuer_ok(), app.current_profile_id(), app.is_staff(), app.is_admin(), app.visible_profile_ids(),
  app.is_seated(uuid), app.has_registration(uuid), app.my_team_ids(), app.poll_eligible_me(public.poll_audience), app.staff_votable_poll_ids()
  to anon, authenticated;

-- The rule functions the app calls over RPC (each checks the caller itself and raises P0001 '<code>').
grant execute on function
  app.register_for_event(uuid, jsonb, jsonb), app.cancel_registration(uuid), app.create_team(uuid, text), app.join_team(text), app.leave_team(uuid),
  app.team_roster(uuid), app.decide_registrations(uuid[], text, text), app.send_decisions(uuid),
  app.complete_onboarding(jsonb, text, integer, text), app.update_prefs(jsonb, text, text), app.update_profile(jsonb, integer, jsonb, text, text),
  app.update_academic(text, text, text, text, text), app.set_semester_subjects(integer, text, text[], boolean),
  app.set_avatar_path(text), app.remove_avatar(),
  app.apply_for_membership(text, text[], jsonb), app.renew_membership(text[]), app.review_membership(uuid, boolean, text),
  app.set_member_status(uuid[], text), app.grant_role(uuid, text), app.upsert_season(jsonb), app.merge_profiles(uuid, uuid),
  app.update_form(text, jsonb), app.submit_join_form(jsonb),
  app.create_event(jsonb), app.preview_event_change(uuid, jsonb), app.update_event(uuid, jsonb), app.set_event_status(uuid, text),
  app.create_poll(jsonb), app.update_poll(uuid, jsonb), app.set_poll_status(uuid, text), app.vote(uuid, text[]), app.poll_tallies(uuid),
  app.submit_feedback(uuid, integer, integer, text, text, boolean), app.feedback_summary(uuid),
  app.mark_read(uuid[]), app.mark_all_read(), app.retry_notification(uuid), app.send_announcement(text, jsonb, jsonb, jsonb),
  app.note_team_code_failure()
  to authenticated;

grant execute on function app.subscribe(text, text, text, text) to anon, authenticated;

-- Server-side only (webhooks, cron, import scripts): writing to other people's outbox is never a person's job.
grant execute on function app.enqueue_notification(uuid, public.notif_template, jsonb, smallint, text, timestamptz),
  app.enqueue_due_reminders(timestamptz), app.enqueue_feedback_requests(timestamptz),
  app.push_inbox(uuid, public.inbox_kind, jsonb, text), app.notify_staff(public.inbox_kind, jsonb, text) to service_role;
