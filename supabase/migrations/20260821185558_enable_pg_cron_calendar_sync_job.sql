-- Schedule the calendar-sync job via pg_cron, same mechanism as the daily-reminder
-- check (`20260817220815_enable_pg_cron_reminder_job.sql`). Runs every 15 minutes —
-- tight enough to catch a time block's start reasonably promptly without hitting
-- Google's Calendar API on every tick (the route itself only re-pulls from Google
-- when a user's local cache is stale; see src/app/api/cron/calendar-sync/route.ts).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'calendar-sync-check';

-- Reuses the same `cron_secret` Vault secret already set up for daily-reminder — same
-- trust boundary (server-to-server cron auth), no need for a second secret.
select cron.schedule(
  'calendar-sync-check',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://i.usetimebud.app/api/cron/calendar-sync',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $$
);
