-- Lightweight persisted gamification: mission difficulty (drives an XP multiplier),
-- a one-time mission-complete bonus guard, and a running XP total per user.

alter table projects
  add column if not exists difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),
  add column if not exists mission_bonus_awarded boolean not null default false;

alter table user_ai_settings
  add column if not exists xp_total integer not null default 0;

-- Centralized XP award/claw-back, triggered off `tasks` regardless of which code path
-- flips the status (UI checkbox, focus-session card, AI chat tool, partial-completion
-- dialog) — a single source of truth instead of duplicating the logic per call site.
-- Symmetric: undoing a completed job claws back the same XP it earned, and undoing the
-- job that completed a mission claws back that mission's one-time bonus too, so toggling
-- a job done/undone repeatedly can't be used to farm XP.
create or replace function award_xp_on_task_completion()
returns trigger as $$
declare
  mult numeric;
  base_xp integer := 10;
  bonus_xp integer := 100;
  remaining integer;
  just_completed boolean;
  just_uncompleted boolean;
begin
  just_completed := (NEW.status = 'completed' and OLD.status is distinct from 'completed');
  just_uncompleted := (OLD.status = 'completed' and NEW.status is distinct from 'completed');

  if NEW.item_type <> 'task' or (not just_completed and not just_uncompleted) then
    return NEW;
  end if;

  select case difficulty when 'easy' then 0.5 when 'hard' then 1.5 else 1.0 end
    into mult
    from projects where id = NEW.project_id;
  mult := coalesce(mult, 1.0);

  if just_completed then
    update user_ai_settings set xp_total = xp_total + round(base_xp * mult)
      where user_id = NEW.user_id;
  elsif just_uncompleted then
    update user_ai_settings set xp_total = greatest(0, xp_total - round(base_xp * mult))
      where user_id = NEW.user_id;
  end if;

  if NEW.project_id is not null then
    select count(*) into remaining
      from tasks
      where project_id = NEW.project_id and item_type = 'task' and status <> 'completed' and not on_hold;

    if just_completed and remaining = 0 then
      update user_ai_settings set xp_total = xp_total + bonus_xp
        where user_id = NEW.user_id
        and exists (select 1 from projects where id = NEW.project_id and mission_bonus_awarded = false);
      update projects set mission_bonus_awarded = true
        where id = NEW.project_id and mission_bonus_awarded = false;
    elsif just_uncompleted and remaining = 1 then
      update user_ai_settings set xp_total = greatest(0, xp_total - bonus_xp)
        where user_id = NEW.user_id
        and exists (select 1 from projects where id = NEW.project_id and mission_bonus_awarded = true);
      update projects set mission_bonus_awarded = false
        where id = NEW.project_id and mission_bonus_awarded = true;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists tasks_award_xp on tasks;
create trigger tasks_award_xp
  after update on tasks
  for each row
  execute function award_xp_on_task_completion();
