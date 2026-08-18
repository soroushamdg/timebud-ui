-- Cleanup: these were temporary diagnostic/one-time-setup helpers, no longer needed
-- now that the cron_secret vault entry is confirmed set and the job is confirmed working.
drop function if exists public.debug_cron_status();
drop function if exists public.debug_set_cron_secret(text);
drop function if exists public.debug_test_cron_call();
