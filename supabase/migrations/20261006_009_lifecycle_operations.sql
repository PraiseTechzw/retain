alter table public.employees
  add column if not exists home_area text,
  add column if not exists commute_distance_km numeric(7, 2);

alter table public.employees
  drop constraint if exists employees_commute_distance_nonnegative;

alter table public.employees
  add constraint employees_commute_distance_nonnegative
  check (commute_distance_km is null or commute_distance_km >= 0);

alter table public.assets
  add column if not exists current_location text;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null,
  starts_on date not null,
  ends_on date not null,
  requested_days numeric(5, 1) not null,
  reason text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_dates_valid check (ends_on >= starts_on),
  constraint leave_requests_days_positive check (requested_days > 0),
  constraint leave_requests_status_valid
    check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create index if not exists leave_requests_employee_dates_idx
  on public.leave_requests(employee_id, starts_on, ends_on);
create index if not exists leave_requests_status_idx
  on public.leave_requests(status);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_year integer not null,
  leave_type text not null,
  entitled_days numeric(5, 1) not null,
  carried_over_days numeric(5, 1) not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint leave_balances_entitlement_nonnegative
    check (entitled_days >= 0 and carried_over_days >= 0),
  constraint leave_balances_employee_year_type_unique
    unique (employee_id, leave_year, leave_type)
);

create index if not exists leave_balances_employee_year_idx
  on public.leave_balances(employee_id, leave_year);

create table if not exists public.asset_daily_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  employee_id uuid references public.employees(id),
  event_type text not null,
  logged_on date not null default current_date,
  location text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint asset_daily_logs_event_type_valid
    check (event_type in ('daily_check', 'movement', 'maintenance', 'issue', 'return'))
);

create index if not exists asset_daily_logs_asset_date_idx
  on public.asset_daily_logs(asset_id, logged_on desc);
create index if not exists asset_daily_logs_employee_id_idx
  on public.asset_daily_logs(employee_id);

create table if not exists public.recruitment_openings (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  department_id uuid references public.departments(id),
  employment_category text not null default 'support',
  status text not null default 'planned',
  positions integer not null default 1,
  target_start_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruitment_openings_positions_positive check (positions > 0),
  constraint recruitment_openings_status_valid
    check (status in ('planned', 'open', 'shortlisting', 'interviewing', 'offered', 'filled', 'cancelled'))
);

create index if not exists recruitment_openings_status_idx
  on public.recruitment_openings(status);

alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.asset_daily_logs enable row level security;
alter table public.recruitment_openings enable row level security;

drop policy if exists authenticated_users_access_leave_requests on public.leave_requests;
create policy authenticated_users_access_leave_requests
  on public.leave_requests for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists authenticated_users_access_leave_balances on public.leave_balances;
create policy authenticated_users_access_leave_balances
  on public.leave_balances for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists authenticated_users_access_asset_daily_logs on public.asset_daily_logs;
create policy authenticated_users_access_asset_daily_logs
  on public.asset_daily_logs for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists authenticated_users_access_recruitment_openings on public.recruitment_openings;
create policy authenticated_users_access_recruitment_openings
  on public.recruitment_openings for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create or replace view public.quarterly_turnover_summary
with (security_invoker = true)
as
with exit_events as (
  select
    e.id as employee_id,
    coalesce(e.exit_date, er.completed_at, er.submitted_on, er.created_at) as exit_at,
    coalesce(d.name, 'Unassigned') as department
  from public.employees e
  left join public.departments d on d.id = e.department_id
  left join public.exit_requests er on er.employee_id = e.id
  where (e.employment_status = 'exited' or er.status = 'completed')
    and coalesce(e.exit_date, er.completed_at, er.submitted_on, er.created_at) is not null
),
quarter_exits as (
  select
    date_trunc('quarter', exit_at)::date as quarter_start,
    department,
    count(distinct employee_id) as exits
  from exit_events
  group by 1, 2
),
current_workforce as (
  select
    coalesce(d.name, 'Unassigned') as department,
    count(*) filter (where e.employment_status = 'active') as active_headcount
  from public.employees e
  left join public.departments d on d.id = e.department_id
  group by 1
)
select
  q.quarter_start,
  q.department,
  q.exits,
  w.active_headcount,
  round((q.exits * 100.0 / nullif(w.active_headcount, 0))::numeric, 1) as attrition_rate_pct
from quarter_exits q
left join current_workforce w on w.department = q.department;
