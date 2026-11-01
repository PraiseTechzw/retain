alter table public.exit_cases
  add column if not exists reason_category text;

do $$
begin
  alter publication supabase_realtime add table public.employees;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.exit_cases;
exception
  when duplicate_object then null;
end $$;

create index if not exists exit_cases_reason_category_idx
  on public.exit_cases (reason_category);

create table if not exists public.quarterly_turnover_reports (
  quarter_start date not null,
  department text not null,
  exits integer not null default 0,
  active_headcount numeric(8, 1) not null default 0,
  top_exit_reason text,
  attrition_rate_pct numeric(8, 1),
  generated_at timestamptz not null default now(),
  primary key (quarter_start, department)
);

alter table public.quarterly_turnover_reports enable row level security;

drop policy if exists "quarterly turnover reports read" on public.quarterly_turnover_reports;
create policy "quarterly turnover reports read"
  on public.quarterly_turnover_reports for select
  using (public.hrms_is_hr());

drop policy if exists "quarterly turnover reports manage" on public.quarterly_turnover_reports;
create policy "quarterly turnover reports manage"
  on public.quarterly_turnover_reports for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

grant select, insert, update, delete on public.quarterly_turnover_reports to authenticated;

create or replace function public.get_quarterly_turnover_summary()
returns table (
  quarter_start date,
  department text,
  exits bigint,
  active_headcount numeric,
  attrition_rate_pct numeric,
  top_exit_reason text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with quarters as (
    select
      (date_trunc('quarter', current_date) - (period.n * interval '3 months'))::date as quarter_start,
      (date_trunc('quarter', current_date) - (period.n * interval '3 months')
        + interval '3 months - 1 day')::date as quarter_end
    from generate_series(0, 7) as period(n)
  ),
  exits as (
    select
      coalesce(ec.completed_at::date, ec.last_day, e.exit_date, ec.created_at::date) as exit_date,
      coalesce(d.name, 'Unassigned') as department,
      coalesce(nullif(btrim(ec.reason_category), ''), nullif(btrim(ec.reason), ''), 'Not recorded') as reason
    from public.exit_cases ec
    join public.employees e on e.id = ec.employee_id
    left join public.departments d on d.id = e.department_id
    where lower(ec.status) in ('completed', 'finalized')
  ),
  grouped_reasons as (
    select
      q.quarter_start,
      x.department,
      x.reason,
      count(*) as reason_count,
      row_number() over (
        partition by q.quarter_start, x.department
        order by count(*) desc, x.reason
      ) as reason_rank
    from quarters q
    join exits x on x.exit_date between q.quarter_start and q.quarter_end
    group by q.quarter_start, x.department, x.reason
  ),
  totals as (
    select q.quarter_start, x.department, count(*) as exits
    from quarters q
    join exits x on x.exit_date between q.quarter_start and q.quarter_end
    group by q.quarter_start, x.department
  ),
  headcounts as (
    select q.quarter_start, coalesce(d.name, 'Unassigned') as department, count(*) as active_headcount
    from quarters q
    join public.employees e
      on coalesce(e.appointment_date, e.created_at::date) <= q.quarter_end
     and coalesce(e.exit_date, current_date + 1) >= q.quarter_start
    left join public.departments d on d.id = e.department_id
    group by q.quarter_start, coalesce(d.name, 'Unassigned')
  )
  select
    q.quarter_start,
    coalesce(t.department, h.department) as department,
    coalesce(t.exits, 0)::bigint,
    coalesce(h.active_headcount, 0)::numeric,
    case when coalesce(h.active_headcount, 0) = 0 then null
      else round(coalesce(t.exits, 0)::numeric * 100 / h.active_headcount, 1)
    end,
    r.reason
  from quarters q
  left join totals t on t.quarter_start = q.quarter_start
  full join headcounts h on h.quarter_start = q.quarter_start and h.department = t.department
  left join grouped_reasons r
    on r.quarter_start = q.quarter_start
   and r.department = coalesce(t.department, h.department)
   and r.reason_rank = 1
  where coalesce(t.department, h.department) is not null
  order by q.quarter_start desc, department;
$$;

grant execute on function public.get_quarterly_turnover_summary() to authenticated;
