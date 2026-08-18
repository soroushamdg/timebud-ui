create or replace function public.debug_test_cron_call()
returns jsonb
language plpgsql
security definer
as $$
declare
  req_id bigint;
  result jsonb;
begin
  select net.http_get(
    url := 'https://i.usetimebud.app/api/cron/daily-reminder',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  ) into req_id;

  perform pg_sleep(2);

  select jsonb_build_object('status_code', status_code, 'body', content::text)
  into result
  from net._http_response
  where id = req_id;

  return result;
end;
$$;

grant execute on function public.debug_test_cron_call() to service_role;
