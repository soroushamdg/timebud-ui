-- Schedule the recurring-task rollover job via pg_cron, same mechanism as daily-reminder
-- and calendar-sync (`20260821185558_enable_pg_cron_calendar_sync_job.sql`). Runs every
-- 30 minutes; the route itself compares each task's due date against "today" in that
-- task owner's own IANA timezone, so a 30-minute cadence catches each user's local
-- midnight rollover promptly without needing per-timezone scheduling.

select cron.unschedule(jobid)
from cron.job
where jobname = 'recurring-rollover-check';

-- Reuses the same `cron_secret` Vault secret already set up for daily-reminder/calendar-sync.
select cron.schedule(
  'recurring-rollover-check',
  '*/30 * * * *',
  $$
  select net.http_get(
    url := 'https://i.usetimebud.app/api/cron/recurring-rollover',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $$
);
