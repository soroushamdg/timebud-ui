-- Toggle for the new "your calendar time block just started" push notification,
-- consistent with every other notification type already having its own on/off switch.
alter table user_ai_settings
  add column if not exists calendar_block_alerts_enabled boolean not null default true;
