alter table public.assets
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_tracking_source text;

alter table public.assets
  drop constraint if exists assets_last_tracking_source_check;
alter table public.assets
  add constraint assets_last_tracking_source_check
  check (last_tracking_source is null or last_tracking_source in ('daily_check', 'barcode', 'rfid', 'gps_mdm', 'manual'));

create table if not exists public.asset_tracking_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  source text not null check (source in ('daily_check', 'barcode', 'rfid', 'gps_mdm', 'manual')),
  location text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  external_event_id text,
  created_at timestamptz not null default now(),
  constraint asset_tracking_external_id_unique unique (source, external_event_id)
);

create index if not exists asset_tracking_events_asset_recorded_idx
  on public.asset_tracking_events(asset_id, recorded_at desc);

alter table public.asset_tracking_events enable row level security;
grant select, insert on public.asset_tracking_events to authenticated;
drop policy if exists asset_tracking_events_read_scope on public.asset_tracking_events;
create policy asset_tracking_events_read_scope
  on public.asset_tracking_events for select
  using (public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library'));

drop policy if exists asset_tracking_events_insert_scope on public.asset_tracking_events;
create policy asset_tracking_events_insert_scope
  on public.asset_tracking_events for insert
  with check (
    created_by = auth.uid()
    and public.current_app_role() in ('administrator', 'hr', 'ict', 'library')
    and source in ('barcode', 'rfid', 'manual')
    and recorded_at >= now() - interval '1 day'
    and recorded_at <= now() + interval '5 minutes'
  );

create or replace function public.apply_asset_tracking_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.assets
  set current_location = coalesce(new.location, current_location),
      last_seen_at = new.recorded_at,
      last_tracking_source = new.source,
      updated_at = now()
  where id = new.asset_id
    and (last_seen_at is null or new.recorded_at >= last_seen_at);
  return new;
end;
$$;

revoke all on function public.apply_asset_tracking_event()
  from public, anon, authenticated;
drop trigger if exists apply_asset_tracking_event on public.asset_tracking_events;
create trigger apply_asset_tracking_event
  after insert on public.asset_tracking_events
  for each row execute function public.apply_asset_tracking_event();

create or replace function public.capture_asset_daily_log_tracking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.asset_tracking_events (
    asset_id, source, location, recorded_at, created_by
  ) values (
    new.asset_id,
    case when new.event_type = 'daily_check' then 'daily_check' else 'manual' end,
    new.location,
    coalesce(new.created_at, now()),
    new.created_by
  );
  return new;
end;
$$;

revoke all on function public.capture_asset_daily_log_tracking()
  from public, anon, authenticated;
drop trigger if exists capture_asset_daily_log_tracking on public.asset_daily_logs;
create trigger capture_asset_daily_log_tracking
  after insert on public.asset_daily_logs
  for each row execute function public.capture_asset_daily_log_tracking();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.assets;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
