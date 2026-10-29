create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique,
  asset_type text not null,
  description text,
  status text not null default 'available'
    check (status in ('available', 'assigned', 'returned', 'verified', 'retired', 'damaged')),
  current_location text,
  assigned_to uuid references public.employees(id) on delete set null,
  returned_at timestamptz,
  verified_at timestamptz,
  last_seen_at timestamptz,
  last_tracking_source text
    check (last_tracking_source is null or last_tracking_source in ('barcode', 'rfid', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_daily_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  event_type text not null
    check (event_type in ('daily_check', 'movement', 'maintenance', 'issue', 'return')),
  logged_on date not null default current_date,
  location text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists asset_daily_logs_one_check_per_day
  on public.asset_daily_logs (asset_id, logged_on)
  where event_type = 'daily_check';

create table if not exists public.asset_tracking_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  source text not null check (source in ('barcode', 'rfid', 'manual')),
  location text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assets_assigned_to_idx
  on public.assets (assigned_to);
create index if not exists asset_history_asset_created_idx
  on public.asset_history (asset_id, created_at desc);
create index if not exists asset_daily_logs_logged_on_idx
  on public.asset_daily_logs (logged_on desc, created_at desc);
create index if not exists asset_tracking_events_asset_created_idx
  on public.asset_tracking_events (asset_id, created_at desc);

create or replace function public.update_asset_last_tracking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.assets
  set last_seen_at = new.created_at,
      last_tracking_source = new.source,
      current_location = new.location,
      updated_at = new.created_at
  where id = new.asset_id;
  return new;
end;
$$;

revoke all on function public.update_asset_last_tracking() from public, anon, authenticated;

drop trigger if exists update_asset_last_tracking on public.asset_tracking_events;
create trigger update_asset_last_tracking
  after insert on public.asset_tracking_events
  for each row execute function public.update_asset_last_tracking();

create or replace view public.asset_employee_directory
with (security_invoker = true)
as
select id, full_name, employee_number, department_id
from public.employees;

alter table public.assets enable row level security;
alter table public.asset_history enable row level security;
alter table public.asset_daily_logs enable row level security;
alter table public.asset_tracking_events enable row level security;

drop policy if exists "assets manage" on public.assets;
create policy "assets manage"
  on public.assets for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

drop policy if exists "asset history read" on public.asset_history;
create policy "asset history read"
  on public.asset_history for select
  using (public.hrms_is_hr());
drop policy if exists "asset history insert" on public.asset_history;
create policy "asset history insert"
  on public.asset_history for insert
  with check (public.hrms_is_hr());

drop policy if exists "asset activity scope" on public.asset_daily_logs;
create policy "asset activity scope"
  on public.asset_daily_logs for select
  using (
    public.hrms_is_hr()
    or exists (
      select 1
      from public.employees e
      where e.id = public.asset_daily_logs.employee_id
        and e.user_id = auth.uid()
    )
  );
drop policy if exists "asset activity insert" on public.asset_daily_logs;
create policy "asset activity insert"
  on public.asset_daily_logs for insert
  with check (
    public.hrms_is_hr()
    or exists (
      select 1
      from public.employees e
      join public.assets a on a.assigned_to = e.id
      where e.id = public.asset_daily_logs.employee_id
        and a.id = public.asset_daily_logs.asset_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "asset tracking read" on public.asset_tracking_events;
create policy "asset tracking read"
  on public.asset_tracking_events for select
  using (public.hrms_is_hr());
drop policy if exists "asset tracking insert" on public.asset_tracking_events;
create policy "asset tracking insert"
  on public.asset_tracking_events for insert
  with check (public.hrms_is_hr());

grant select, insert, update, delete on public.assets to authenticated;
grant select, insert on public.asset_history to authenticated;
grant select, insert on public.asset_daily_logs to authenticated;
grant select, insert on public.asset_tracking_events to authenticated;
grant select on public.asset_employee_directory to authenticated;

grant all privileges on public.assets to service_role;
grant all privileges on public.asset_history to service_role;
grant all privileges on public.asset_daily_logs to service_role;
grant all privileges on public.asset_tracking_events to service_role;
grant select on public.asset_employee_directory to service_role;
