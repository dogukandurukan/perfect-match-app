-- DB → Edge Function calls without any key in SQL text (P0 key plan).
-- PROPOSED, NOT APPLIED. Order and preconditions: docs/tempa/P0_KEY_ROTATION_PLAN.md.
--
-- Precondition (owner, NOT in this file, value never written to the repo):
--   select vault.create_secret('<random ≥32-char value>', 'tempa_webhook_secret',
--     'DB → Edge Function caller secret');
--   and the same value as the Edge Function secret TEMPA_WEBHOOK_SECRET.
-- The project URL is not secret; it is stored in Vault too so the SQL stays
-- identical between the test and live projects:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'tempa_project_url', 'Edge Function base URL');
--
-- This replaces the Dashboard-created `matches-push-notification` webhook
-- (whose trigger text embeds a service-role JWT) and the reminder cron job
-- (which calls a function that had no authentication at all).

begin;

create or replace function public.call_edge_function(p_function text, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'tempa_webhook_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'tempa_project_url';
  if v_secret is null or v_url is null then
    raise warning 'call_edge_function: vault secret missing, % not called', p_function;
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/' || p_function,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tempa-webhook-secret', v_secret),
    body := p_payload,
    timeout_milliseconds := 5000
  );
end;
$$;
revoke all on function public.call_edge_function(text, jsonb) from public, anon, authenticated;

-- Same payload shape the Dashboard webhook sent (type/table/record/old_record).
create or replace function public.matches_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.call_edge_function('send-push-notification', jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end));
  return new;
end;
$$;
revoke all on function public.matches_push_webhook() from public, anon, authenticated;

drop trigger if exists "matches-push-notification" on public.matches;
drop trigger if exists matches_push_webhook on public.matches;
create trigger matches_push_webhook
  after insert or update on public.matches
  for each row execute function public.matches_push_webhook();

-- Reminder cron: same schedule, now authenticated via the Vault secret.
select cron.unschedule(jobid) from cron.job where jobname = 'daily-meetup-reminders';
select cron.schedule('daily-meetup-reminders', '0 * * * *',
  $cron$ select public.call_edge_function('send-meetup-reminders', '{}'::jsonb); $cron$);

commit;
