-- Cross-device sync for the running focus session. Previously a session row was only
-- ever written after the run finished (see useCreateCompletedFocusSession), so a run
-- in progress lived entirely in one browser's localStorage (Zustand persist) and had no
-- pause concept at all. These columns let a session row be created at start time and
-- updated live (status/pause bookkeeping + a full task-progress snapshot) so any device
-- signed in as the same user can see and control the same run.

alter table sessions
  add column if not exists status text not null default 'running',
  add column if not exists paused_at timestamptz,
  add column if not exists total_paused_seconds integer not null default 0,
  add column if not exists planned_tasks jsonb not null default '[]'::jsonb;

do $mig$ begin
  alter table sessions
    add constraint sessions_status_check check (status in ('running', 'paused', 'completed', 'abandoned'));
exception when duplicate_object then null;
end $mig$;

-- Backfill: any historical row that already has an end_time was in fact completed
-- (the status column didn't exist yet, so every row defaulted to 'running' above).
update sessions set status = 'completed' where end_time is not null and status = 'running';

-- `sessions` predates tracked migrations, so its RLS policies (if any) aren't in this
-- repo. Only add a default owner-scoped policy if the table has none at all, so this
-- never loosens or duplicates whatever policy already exists in production.
do $mig$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions'
  ) then
    execute 'alter table sessions enable row level security';
    execute $pol$
      create policy "manage own sessions" on sessions
        for all using (auth.uid() = user_id) with check (auth.uid() = user_id)
    $pol$;
  end if;
end $mig$;

-- Full row data on every change (not just the primary key), so an UPDATE/DELETE
-- realtime payload always includes user_id and the rest of the row for the client
-- filter/handler in useFocusSessionRealtime to read.
alter table sessions replica identity full;

do $mig$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    execute 'alter publication supabase_realtime add table sessions';
  end if;
end $mig$;
