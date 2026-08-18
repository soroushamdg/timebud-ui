-- Lets the app auto-update a user's stored timezone when their device timezone
-- changes (e.g. traveling), while still allowing an explicit manual override that
-- won't get silently clobbered on the next sync.
alter table user_ai_settings
  add column if not exists auto_timezone_enabled boolean not null default true;
