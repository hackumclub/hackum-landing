-- 12b/15 Clerk webhook helpers (service role only; the sign-in itself is Clerk's, nothing here issues tokens).
--   upsert_clerk_profile: user.created / user.updated. Known Clerk id -> refresh email. Email of an unclaimed legacy profile -> claim it.
--   Otherwise a new guest profile (not onboarded yet: the onboarding sheet calls complete_onboarding).
--   anonymize_clerk_user: user.deleted. The profile row stays (aggregates, history) but loses every personal field.

create function app.upsert_clerk_profile(p_clerk_user_id text, p_email text, p_name jsonb default null, p_locale text default 'mn') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), ''); v_id uuid; v_base text; v_handle text; v_name jsonb;
begin
  if coalesce(btrim(p_clerk_user_id), '') = '' or p_locale not in ('mn', 'en') then perform app.fail('invalid'); end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then perform app.fail('invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('hackum.clerk:' || p_clerk_user_id));

  select id into v_id from public.profiles where clerk_user_id = p_clerk_user_id;
  if found then
    -- Keep the address in step unless it already belongs to another profile.
    if v_email is not null and not exists (select 1 from public.profiles x where lower(x.email::text) = v_email and x.id <> v_id) then
      update public.profiles set email = v_email, last_seen_at = now() where id = v_id and deleted_at is null;
    end if;
    return v_id;
  end if;

  if v_email is not null then
    select id into v_id from public.profiles where lower(email::text) = v_email and clerk_user_id is null and deleted_at is null for update;
    if found then
      update public.profiles set clerk_user_id = p_clerk_user_id, last_seen_at = now() where id = v_id;
      perform app.audit('profile.claim', 'profiles', v_id::text);
      return v_id;
    end if;
    if exists (select 1 from public.profiles where lower(email::text) = v_email) then perform app.fail('conflict'); end if;
  end if;

  v_name := case when p_name is not null and jsonb_typeof(p_name) = 'object'
    then jsonb_build_object('mn', left(btrim(coalesce(p_name ->> 'mn', p_name ->> 'en', '')), 80), 'en', left(btrim(coalesce(p_name ->> 'en', '')), 80))
    else jsonb_build_object('mn', '', 'en', '') end;
  v_base := trim(both '-' from regexp_replace(lower(split_part(coalesce(v_email, ''), '@', 1)), '[^a-z0-9]+', '-', 'g'));
  v_base := left(v_base, 30);
  if length(v_base) < 3 then v_base := 'member'; end if;
  v_handle := v_base;
  if exists (select 1 from public.profiles where handle::text = v_handle) then
    v_handle := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (clerk_user_id, email, handle, name, locale, last_seen_at)
  values (p_clerk_user_id, v_email, v_handle, v_name, p_locale, now()) returning id into v_id;
  return v_id;
end $$;

create function app.anonymize_clerk_user(p_clerk_user_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where clerk_user_id = p_clerk_user_id and deleted_at is null for update;
  if not found then return false; end if;
  delete from public.staff_roles where profile_id = v_id;
  update public.profiles set deleted_at = now(), email = null, clerk_user_id = null, avatar_path = null, links = '{}', school = null, major = null,
    program_index = null, name = jsonb_build_object('mn', '', 'en', ''), handle = ('deleted-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::extensions.citext
  where id = v_id;
  delete from public.inbox where profile_id = v_id;
  delete from public.form_submissions where profile_id = v_id;
  perform app.audit('profile.anonymize', 'profiles', v_id::text);
  return true;
end $$;

revoke execute on function app.upsert_clerk_profile(text, text, jsonb, text), app.anonymize_clerk_user(text) from public, anon, authenticated;
grant execute on function app.upsert_clerk_profile(text, text, jsonb, text), app.anonymize_clerk_user(text) to service_role;
