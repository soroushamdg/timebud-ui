-- Every calendar beyond the dedicated "TimeBud" one now matters to the planner — as a
-- wall, not a reservation. Their event titles are never stored: only busy intervals,
-- read through Google's freeBusy endpoint (which already honours "free" transparency,
-- declined invitations and cancelled events). The user picks which calendars count;
-- holiday feeds default off. Planning hours and a minimum gap become user settings so
-- the daily budget acts as a ceiling on calendar-derived capacity instead of being the
-- only source of it.

create table if not exists google_calendar_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null,
  summary text,
  is_primary boolean not null default false,
  is_busy_source boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, calendar_id)
);
alter table google_calendar_sources enable row level security;
-- Rows are written by the sync (service client); the user only reads them and flips
-- is_busy_source from Settings.
create policy "select own calendar sources" on google_calendar_sources
  for select using (auth.uid() = user_id);
create policy "update own calendar sources" on google_calendar_sources
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists google_calendar_busy_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  synced_at timestamptz not null default now()
);
alter table google_calendar_busy_cache enable row level security;
create policy "select own busy intervals" on google_calendar_busy_cache
  for select using (auth.uid() = user_id);

create index if not exists idx_calendar_busy_cache_user_time
  on google_calendar_busy_cache (user_id, start_time, end_time);

-- Local wall-clock 'HH:MM' bounds the planner may schedule into, and the shortest free
-- gap worth planning at all.
alter table user_ai_settings
  add column if not exists planning_start_time text not null default '06:00',
  add column if not exists planning_end_time text not null default '23:00',
  add column if not exists min_gap_minutes integer not null default 20;

-- Whether a mission's jobs may overflow past its reserved calendar blocks into free
-- planning time. Read by the planner; nothing in the calendar layer writes it.
alter table projects
  add column if not exists calendar_spillover boolean not null default false;
