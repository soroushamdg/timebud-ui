-- Google Calendar integration: a per-user OAuth connection to a dedicated calendar,
-- a mapping from calendar-event titles to the mission(s) they represent (confirmed
-- once by the user, then remembered for every future occurrence of a recurring block),
-- and a local cache of upcoming/active events so the sync cron doesn't have to hit
-- Google's API on every tick just to check whether a block has started.

create table if not exists google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  google_calendar_id text not null,
  google_account_email text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
alter table google_calendar_connections enable row level security;
create policy "select own connection" on google_calendar_connections
  for select using (auth.uid() = user_id);
create policy "insert own connection" on google_calendar_connections
  for insert with check (auth.uid() = user_id);
create policy "update own connection" on google_calendar_connections
  for update using (auth.uid() = user_id);
create policy "delete own connection" on google_calendar_connections
  for delete using (auth.uid() = user_id);

create table if not exists calendar_block_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_title text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, event_title)
);
alter table calendar_block_mappings enable row level security;
create policy "manage own block mappings" on calendar_block_mappings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists calendar_block_mission_links (
  mapping_id uuid not null references calendar_block_mappings(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  primary key (mapping_id, project_id)
);
alter table calendar_block_mission_links enable row level security;
create policy "manage own block links" on calendar_block_mission_links
  for all using (
    exists (select 1 from calendar_block_mappings m where m.id = mapping_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from calendar_block_mappings m where m.id = mapping_id and m.user_id = auth.uid())
  );

create table if not exists google_calendar_events_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_event_id text not null,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  notified_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (user_id, google_event_id)
);
alter table google_calendar_events_cache enable row level security;
create policy "select own cached events" on google_calendar_events_cache
  for select using (auth.uid() = user_id);

create index if not exists idx_calendar_events_cache_user_time
  on google_calendar_events_cache (user_id, start_time, end_time);
