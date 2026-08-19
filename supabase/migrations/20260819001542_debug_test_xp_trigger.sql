-- TEMPORARY diagnostic function to verify the tasks_award_xp trigger end-to-end
-- (award on completion, mission-complete bonus, symmetric claw-back on undo) without
-- touching any real user data. Dropped again once verified.
create or replace function debug_test_xp_trigger()
returns jsonb as $$
declare
  test_user_id text;
  test_project_id text := gen_random_uuid()::text;
  test_task_id text := gen_random_uuid()::text;
  xp_before integer;
  xp_after_complete integer;
  xp_after_undo integer;
  bonus_awarded_after boolean;
  result jsonb;
begin
  select user_id::text into test_user_id from user_ai_settings limit 1;
  if test_user_id is null then
    return jsonb_build_object('error', 'no user_ai_settings row found to test against');
  end if;

  select xp_total into xp_before from user_ai_settings where user_id::text = test_user_id;

  insert into projects (id, user_id, name, status, difficulty)
    values (test_project_id, test_user_id, '__xp_test_mission__', 'active', 'hard');

  insert into tasks (id, user_id, project_id, item_type, title, status)
    values (test_task_id, test_user_id, test_project_id, 'task', '__xp_test_job__', 'pending');

  update tasks set status = 'completed' where id::text = test_task_id;
  select xp_total into xp_after_complete from user_ai_settings where user_id::text = test_user_id;
  select mission_bonus_awarded into bonus_awarded_after from projects where id::text = test_project_id;

  update tasks set status = 'pending' where id::text = test_task_id;
  select xp_total into xp_after_undo from user_ai_settings where user_id::text = test_user_id;

  delete from tasks where id::text = test_task_id;
  delete from projects where id::text = test_project_id;

  result := jsonb_build_object(
    'xp_before', xp_before,
    'xp_after_complete_hard_job', xp_after_complete,
    'expected_after_complete', xp_before + 15 + 100,
    'mission_bonus_awarded_after_single_job_mission', bonus_awarded_after,
    'xp_after_undo', xp_after_undo,
    'expected_after_undo', xp_before
  );
  return result;
end;
$$ language plpgsql security definer;
