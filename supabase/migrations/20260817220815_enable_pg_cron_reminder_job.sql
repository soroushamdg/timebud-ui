-- Schedule the daily reminder check via pg_cron instead of Vercel Cron (Hobby plan
-- only allows once-per-day schedules; this needs hourly granularity so each user's
-- chosen local reminder time is honored reasonably precisely).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Idempotent: drop any previous version of this job before (re)scheduling it.
select cron.unschedule(jobid)
from cron.job
where jobname = 'daily-reminder-check';

-- Runs hourly. The route itself decides whether to actually send anything: it only
-- notifies users whose configured local reminder time matches the current hour and
-- who haven't touched the app yet today — see
-- src/app/api/cron/daily-reminder/route.ts for that logic.
--
-- The bearer token is read from Supabase Vault at call time rather than hardcoded
-- here. One-time setup (run once in the SQL editor, not part of this migration so
-- the secret itself never lands in git):
--   select vault.create_secret('<CRON_SECRET value>', 'cron_secret', 'Bearer token for /api/cron/daily-reminder');
select cron.schedule(
  'daily-reminder-check',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'https://i.usetimebud.app/api/cron/daily-reminder',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $$
);
