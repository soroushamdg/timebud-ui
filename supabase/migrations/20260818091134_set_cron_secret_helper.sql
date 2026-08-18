-- One-time helper to set/update the 'cron_secret' Vault secret without ever putting the
-- actual secret value in a committed migration file. Takes the value as a runtime RPC
-- argument instead. Dropped again once used (see the immediately-following migration).
create or replace function public.debug_set_cron_secret(secret_value text)
returns void
language plpgsql
security definer
as $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = 'cron_secret';
  if existing_id is not null then
    perform vault.update_secret(existing_id, secret_value);
  else
    perform vault.create_secret(secret_value, 'cron_secret', 'Bearer token for /api/cron/daily-reminder');
  end if;
end;
$$;

grant execute on function public.debug_set_cron_secret(text) to service_role;
