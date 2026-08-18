-- Expands the single inactivity-nudge reminder into a set of independently-toggleable
-- notification types (morning briefing, deadline alerts, weekly look-ahead, unfinished
-- focus session, streaks). reminder_enabled/reminder_time keep their existing meaning
-- (the inactivity nudge specifically).
alter table user_ai_settings
  add column if not exists morning_briefing_enabled boolean not null default true,
  add column if not exists morning_briefing_time text not null default '07:00',
  add column if not exists deadline_alerts_enabled boolean not null default true,
  add column if not exists weekly_lookahead_enabled boolean not null default true,
  add column if not exists unfinished_session_alerts_enabled boolean not null default true,
  add column if not exists streak_alerts_enabled boolean not null default false,
  add column if not exists last_streak_milestone smallint not null default 0;

-- Dedup marker so the unfinished-session nudge only fires once per session, not once
-- per hourly cron tick.
alter table sessions
  add column if not exists unfinished_reminder_sent_at timestamptz;
