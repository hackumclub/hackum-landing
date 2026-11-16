-- 15/15 Jobs: every 5 minutes queue due reminders and feedback requests, then wake the app's dispatcher (/api/cron/dispatch).
-- Skipped (with a notice) when pg_cron or pg_net are not available, so `supabase db reset` works on any local stack.
--
-- Secrets are read from Supabase Vault at run time; nothing secret lives in SQL. Create them once per project (SQL editor):
--   select vault.create_secret('https://<your site>', 'hackum_site_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'hackum_cron_secret');
-- Without both secrets the job still queues reminders and feedback requests; it just does not ping the dispatcher.

do $migration$
begin
  if not (exists (select 1 from pg_available_extensions where name = 'pg_cron') and exists (select 1 from pg_available_extensions where name = 'pg_net')) then
    raise notice 'pg_cron / pg_net not available: cron migration skipped';
    return;
  end if;

  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;

  execute $fn$
    create or replace function app.ping_dispatch() returns boolean
    language plpgsql security definer set search_path = '' as $body$
    declare v_url text; v_secret text;
    begin
      select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'hackum_site_url';
      select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'hackum_cron_secret';
      if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
        raise warning 'vault secrets hackum_site_url / hackum_cron_secret missing: dispatcher not pinged';
        return false;
      end if;
      perform net.http_post(
        url := rtrim(v_url, '/') || '/api/cron/dispatch',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000);
      return true;
    end $body$;
  $fn$;

  execute $fn$
    create or replace function app.cron_tick() returns void
    language plpgsql security definer set search_path = '' as $body$
    begin
      -- Each step is isolated: a failure in one is reported and never blocks the next.
      begin perform app.enqueue_due_reminders(); exception when others then raise warning 'enqueue_due_reminders failed: %', sqlerrm; end;
      begin perform app.enqueue_feedback_requests(); exception when others then raise warning 'enqueue_feedback_requests failed: %', sqlerrm; end;
      begin perform app.ping_dispatch(); exception when others then raise warning 'ping_dispatch failed: %', sqlerrm; end;
    end $body$;
  $fn$;

  revoke execute on function app.ping_dispatch(), app.cron_tick() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'hackum-tick') then
    perform cron.unschedule('hackum-tick');
  end if;
  perform cron.schedule('hackum-tick', '*/5 * * * *', 'select app.cron_tick()');
end $migration$;
