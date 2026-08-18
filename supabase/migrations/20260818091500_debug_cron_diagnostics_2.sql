create or replace function public.debug_cron_status()
returns jsonb
language plpgsql
security definer
as $$
declare
  job_info jsonb;
  run_details jsonb;
  net_responses jsonb;
  vault_check jsonb;
begin
  select jsonb_agg(to_jsonb(j)) into job_info
  from (select jobid, jobname, schedule, active from cron.job where jobname = 'daily-reminder-check') j;

  select jsonb_agg(to_jsonb(r)) into run_details
  from (
    select jobid, status, return_message, start_time, end_time
    from cron.job_run_details
    order by start_time desc
    limit 3
  ) r;

  select jsonb_agg(to_jsonb(n)) into net_responses
  from (
    select id, status_code, content::text as body, created
    from net._http_response
    order by created desc
    limit 3
  ) n;

  select jsonb_agg(jsonb_build_object('name', name, 'has_secret', decrypted_secret is not null, 'secret_length', length(decrypted_secret)))
  into vault_check
  from vault.decrypted_secrets
  where name = 'cron_secret';

  return jsonb_build_object('job', job_info, 'run_details', run_details, 'net_responses', net_responses, 'vault', vault_check);
end;
$$;

grant execute on function public.debug_cron_status() to service_role;
