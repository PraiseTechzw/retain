create table if not exists public.quarterly_turnover_reports (
  quarter_start date not null,
  department text not null,
  exits integer not null default 0 check (exits >= 0),
  active_headcount numeric(8, 1) not null default 0 check (active_headcount >= 0),
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
grant all privileges on public.quarterly_turnover_reports to service_role;

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
      (
        date_trunc('quarter', current_date)
        - (period.n * interval '3 months')
        + interval '3 months - 1 day'
      )::date as quarter_end
    from generate_series(0, 7) as period(n)
  ),
  departments as (
    select d.id, d.name
    from public.departments d
    union all
    select null::uuid, 'Unassigned'
    where exists (
      select 1
      from public.employees e
      where e.department_id is null
    )
    and not exists (
      select 1
      from public.departments d
      where d.name = 'Unassigned'
    )
  ),
  completed_exits as (
    select
      coalesce(ec.completed_at::date, ec.last_day, e.exit_date, ec.created_at::date) as exit_date,
      coalesce(d.name, 'Unassigned') as department,
      nullif(btrim(ec.reason), '') as reason
    from public.exit_cases ec
    join public.employees e on e.id = ec.employee_id
    left join public.departments d on d.id = e.department_id
    where lower(ec.status) in ('completed', 'finalized')
  ),
  exit_totals as (
    select q.quarter_start, x.department, count(*) as exits
    from quarters q
    join completed_exits x
      on x.exit_date between q.quarter_start and q.quarter_end
    group by q.quarter_start, x.department
  ),
  exit_reasons as (
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
    join completed_exits x
      on x.exit_date between q.quarter_start and q.quarter_end
    where x.reason is not null
    group by q.quarter_start, x.department, x.reason
  ),
  employee_spans as (
    select
      e.department_id,
      coalesce(d.name, 'Unassigned') as department,
      coalesce(e.appointment_date, e.created_at::date) as start_date,
      coalesce(
        e.exit_date,
        (
          select coalesce(ec.completed_at::date, ec.last_day, ec.created_at::date)
          from public.exit_cases ec
          where ec.employee_id = e.id
            and lower(ec.status) in ('completed', 'finalized')
          order by coalesce(ec.completed_at::date, ec.last_day, ec.created_at::date) desc
          limit 1
        )
      ) as end_date,
      lower(coalesce(e.employment_status, '')) as employment_status
    from public.employees e
    left join public.departments d on d.id = e.department_id
  ),
  headcounts as (
    select
      q.quarter_start,
      d.name as department,
      round(
        coalesce(
          sum(
            least(coalesce(span.end_date, q.quarter_end), q.quarter_end)
            - greatest(span.start_date, q.quarter_start)
            + 1
          ) filter (
            where span.start_date <= q.quarter_end
              and coalesce(span.end_date, q.quarter_end) >= q.quarter_start
              and (
                span.employment_status not in ('exited', 'resigned', 'departed', 'terminated')
                or span.end_date is not null
              )
          ),
          0
        )::numeric
        / (q.quarter_end - q.quarter_start + 1),
        1
      ) as active_headcount
    from quarters q
    cross join departments d
    left join employee_spans span
      on span.department_id is not distinct from d.id
    group by q.quarter_start, q.quarter_end, d.name
  )
  select
    q.quarter_start,
    d.name as department,
    coalesce(x.exits, 0)::bigint as exits,
    coalesce(h.active_headcount, 0)::numeric as active_headcount,
    case
      when coalesce(h.active_headcount, 0) = 0 then null
      else round(coalesce(x.exits, 0)::numeric * 100 / h.active_headcount, 1)
    end as attrition_rate_pct,
    r.reason as top_exit_reason
  from quarters q
  cross join departments d
  left join exit_totals x
    on x.quarter_start = q.quarter_start
    and x.department = d.name
  left join headcounts h
    on h.quarter_start = q.quarter_start
    and h.department = d.name
  left join exit_reasons r
    on r.quarter_start = q.quarter_start
    and r.department = d.name
    and r.reason_rank = 1
  order by q.quarter_start desc, d.name;
$$;

revoke all on function public.get_quarterly_turnover_summary() from public, anon;
grant execute on function public.get_quarterly_turnover_summary() to authenticated, service_role;
