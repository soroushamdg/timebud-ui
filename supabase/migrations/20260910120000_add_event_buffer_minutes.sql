-- Breathing room around calendar events: free windows start this many minutes after
-- a busy event or TimeBud block ends and stop this many minutes before the next one
-- begins. Blocks themselves keep their full minutes — only free time shrinks. Zero
-- keeps today's behaviour for everyone who never touches the setting.
alter table user_ai_settings
  add column if not exists event_buffer_minutes integer not null default 0;
