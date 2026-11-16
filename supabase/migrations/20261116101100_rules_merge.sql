-- 12/15 merge_profiles (port of members.ts mergeProfiles): fold a legacy duplicate into the profile to keep. Admin only.
-- The dropped profile is soft-deleted (anonymised: no email, no Clerk link, handle renamed) so history stays intact.

create function app.merge_profiles(p_keep uuid, p_drop uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.profiles;
begin
  perform app.require_staff(true);
  if p_keep is null or p_drop is null or p_keep = p_drop then perform app.fail('invalid'); end if;
  -- Lock both in id order so two merges can never deadlock.
  perform 1 from public.profiles where id in (p_keep, p_drop) order by id for update;
  if not exists (select 1 from public.profiles where id = p_keep and deleted_at is null) then perform app.fail('not_found'); end if;
  select * into d from public.profiles where id = p_drop and deleted_at is null;
  if not found then perform app.fail('not_found'); end if;

  if exists (select 1 from public.staff_roles r where r.profile_id = p_drop and r.role = 'admin') and (select count(*) from public.staff_roles where role = 'admin') <= 1 then
    perform app.fail('conflict');
  end if;
  delete from public.memberships m where m.profile_id = p_drop and exists (select 1 from public.memberships x where x.profile_id = p_keep and x.season = m.season);
  update public.memberships set profile_id = p_keep where profile_id = p_drop;
  delete from public.event_registrations r where r.profile_id = p_drop and exists (select 1 from public.event_registrations x where x.profile_id = p_keep and x.event_id = r.event_id);
  update public.event_registrations set profile_id = p_keep where profile_id = p_drop;
  delete from public.membership_applications a where a.profile_id = p_drop and exists (select 1 from public.membership_applications x where x.profile_id = p_keep and x.season = a.season);
  update public.membership_applications set profile_id = p_keep where profile_id = p_drop;
  update public.teams set captain_profile_id = p_keep where captain_profile_id = p_drop;
  update public.notifications set profile_id = p_keep where profile_id = p_drop;
  update public.inbox set profile_id = p_keep where profile_id = p_drop;
  delete from public.event_feedback f where f.profile_id = p_drop and exists (select 1 from public.event_feedback x where x.profile_id = p_keep and x.event_id = f.event_id);
  update public.event_feedback set profile_id = p_keep where profile_id = p_drop;
  delete from public.poll_votes v where v.profile_id = p_drop and exists (select 1 from public.poll_votes x where x.profile_id = p_keep and x.poll_id = v.poll_id);
  update public.poll_votes set profile_id = p_keep where profile_id = p_drop;
  delete from public.form_submissions s where s.profile_id = p_drop and exists (select 1 from public.form_submissions x where x.profile_id = p_keep and x.form_id = s.form_id);
  update public.form_submissions set profile_id = p_keep where profile_id = p_drop;
  delete from public.profile_semesters s where s.profile_id = p_drop and exists (select 1 from public.profile_semesters x where x.profile_id = p_keep and x.year = s.year and x.term = s.term);
  update public.profile_semesters set profile_id = p_keep where profile_id = p_drop;
  delete from public.staff_roles where profile_id = p_drop;

  update public.profiles set deleted_at = now(), email = null, clerk_user_id = null,
    handle = (d.handle::text || '-merged-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::extensions.citext
  where id = p_drop;
  perform app.audit('profile.merge', 'profiles', p_keep::text, jsonb_build_object('merged', p_drop));
end $$;
