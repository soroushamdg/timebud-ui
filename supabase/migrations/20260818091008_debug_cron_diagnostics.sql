-- Temporary diagnostic function to verify the daily-reminder pg_cron job is actually
-- firing and getting a real (non-401) response from the deployed endpoint. Read once
-- via the app's service-role client, then dropped in a follow-up migration — not meant
-- to stay in the schema long-term.
create or replace function public.debug_cron_status()
returns jsonb
language plpgsql
security definer
as $$
declare
  job_info jsonb;
  run_details jsonb;
  net_responses jsonb;
begin
  select jsonb_agg(to_jsonb(j)) into job_info
  from (select jobid, jobname, schedule, active from cron.job where jobname = 'daily-reminder-check') j;

  select jsonb_agg(to_jsonb(r)) into run_details
  from (
    select jobid, status, return_message, start_time, end_time
    from cron.job_run_details
    order by start_time desc
    limit 10
  ) r;

  begin
    select jsonb_agg(to_jsonb(n)) into net_responses
    from (
      select id, status_code, content::text as body, created
      from net._http_response
      order by created desc
      limit 10
    ) n;
  exception when undefined_table then
    net_responses := '"net._http_response table not found"'::jsonb;
  end;

  return jsonb_build_object('job', job_info, 'run_details', run_details, 'net_responses', net_responses);
end;
$$;

grant execute on function public.debug_cron_status() to service_role;
