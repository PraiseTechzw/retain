-- Durable daily notification delivery. The scheduler runs in Supabase, not in
-- the Next.js process or a user's browser.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  digest_date date not null,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'sent',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (digest_date, recipient_email)
);

create index if not exists notification_delivery_log_date_idx
  on public.notification_delivery_log(digest_date);

alter table public.notification_delivery_log enable row level security;

create or replace function public.invoke_daily_email_notifications()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'supabase_url';

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key';

  if coalesce(v_url, '') = '' or coalesce(v_key, '') = '' then
    raise exception 'Missing Vault secrets: supabase_url and supabase_service_role_key';
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/daily-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
end;
$$;

revoke execute on function public.invoke_daily_email_notifications() from public, anon, authenticated;

do $schedule$
begin
  if exists (select 1 from cron.job where jobname = 'daily-email-notifications') then
    perform cron.unschedule('daily-email-notifications');
  end if;

  perform cron.schedule(
    'daily-email-notifications',
    '0 7 * * *',
    $job$select public.invoke_daily_email_notifications();$job$
  );
end;
$schedule$;