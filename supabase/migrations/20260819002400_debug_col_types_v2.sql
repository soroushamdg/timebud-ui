create or replace function debug_col_types()
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name, 'type', data_type))
  into result
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('projects', 'tasks', 'user_ai_settings')
    and column_name in ('id', 'user_id', 'project_id');
  return result;
end;
$$ language plpgsql security definer;
