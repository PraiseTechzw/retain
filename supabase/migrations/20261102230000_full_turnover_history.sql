create or replace function public.get_quarterly_turnover_history()
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
security definer
set search_path = ''
as $$
  with quarters as (
    select
      (date_trunc('quarter', current_date) - (period.n * interval '3 months'))::date as quarter_start,
      (date_trunc('quarter', current_date) - (period.n * interval '3 months')
        + interval '3 months - 1 day')::date as quarter_end
    from generate_series(0, 15) as period(n)
  ),
  exits as (
    select
      past.exit_date,
      coalesce(d.name, 'Unassigned') as department,
      lower(btrim(past.reason_category)) as reason
    from public.past_exit_records past
    join public.employees e on e.id = past.employee_id
    left join public.departments d on d.id = coalesce(past.department_id, e.department_id)
    union all
    select
      coalesce(ec.last_day, ec.completed_at::date, e.exit_date, ec.created_at::date),
      coalesce(d.name, 'Unassigned'),
      lower(btrim(coalesce(ec.reason_category, ec.reason, 'other')))
    from public.exit_cases ec
    join public.employees e on e.id = ec.employee_id
    left join public.departments d on d.id = e.department_id
    where lower(ec.status) in ('completed', 'finalized')
  ),
  totals as (
    select q.quarter_start, x.department, count(*) as exits
    from quarters q
    join exits x on x.exit_date between q.quarter_start and least(q.quarter_end, current_date)
    group by q.quarter_start, x.department
  ),
  reasons as (
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
    join exits x on x.exit_date between q.quarter_start and least(q.quarter_end, current_date)
    group by q.quarter_start, x.department, x.reason
  ),
  headcounts as (
    select
      q.quarter_start,
      coalesce(d.name, 'Unassigned') as department,
      count(*) filter (
        where coalesce(e.appointment_date, e.joined_on, e.created_at::date) <= q.quarter_start
          and coalesce(e.exit_date, current_date + 1) >= q.quarter_start
      ) as start_headcount,
      count(*) filter (
        where coalesce(e.appointment_date, e.joined_on, e.created_at::date)
              <= least(q.quarter_end, current_date)
          and coalesce(e.exit_date, current_date + 1)
              >= least(q.quarter_end, current_date)
      ) as end_headcount
    from quarters q
    join public.employees e
      on coalesce(e.appointment_date, e.joined_on, e.created_at::date)
           <= least(q.quarter_end, current_date)
     and coalesce(e.exit_date, current_date + 1) >= q.quarter_start
    left join public.departments d on d.id = e.department_id
    group by q.quarter_start, coalesce(d.name, 'Unassigned')
  ),
  periods as (
    select quarter_start, department from totals
    union
    select quarter_start, department from headcounts
  )
  select
    p.quarter_start,
    p.department,
    coalesce(t.exits, 0)::bigint,
    round((coalesce(h.start_headcount, 0) + coalesce(h.end_headcount, 0))::numeric / 2, 1),
    case
      when coalesce(h.start_headcount, 0) + coalesce(h.end_headcount, 0) = 0 then null
      else round(
        coalesce(t.exits, 0)::numeric * 100 /
        ((h.start_headcount + h.end_headcount)::numeric / 2),
        1
      )
    end,
    case when r.reason_count >= 5 then r.reason else null end
  from periods p
  left join totals t on t.quarter_start = p.quarter_start and t.department = p.department
  left join headcounts h on h.quarter_start = p.quarter_start and h.department = p.department
  left join reasons r
    on r.quarter_start = p.quarter_start
   and r.department = p.department
   and r.reason_rank = 1
  where (select public.hrms_role()) in ('administrator', 'hr', 'hr_manager')
  order by p.quarter_start desc, p.department;
$$;

revoke all on function public.get_quarterly_turnover_history() from public, anon;
grant execute on function public.get_quarterly_turnover_history() to authenticated;

create or replace function public.get_turnover_baseline_filtered(
  p_from date default null,
  p_to date default null,
  p_department text default null
)
returns table (
  school text,
  department text,
  reason_category text,
  exits bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with exit_history as (
    select
      past.exit_date,
      coalesce(d.school, 'Not recorded') as school,
      coalesce(d.name, 'Unassigned') as department,
      lower(btrim(past.reason_category)) as reason_category
    from public.past_exit_records past
    join public.employees e on e.id = past.employee_id
    left join public.departments d on d.id = coalesce(past.department_id, e.department_id)
    union all
    select
      coalesce(ec.last_day, ec.completed_at::date, e.exit_date, ec.created_at::date),
      coalesce(d.school, 'Not recorded'),
      coalesce(d.name, 'Unassigned'),
      lower(btrim(coalesce(ec.reason_category, ec.reason, 'other')))
    from public.exit_cases ec
    join public.employees e on e.id = ec.employee_id
    left join public.departments d on d.id = e.department_id
    where lower(ec.status) in ('completed', 'finalized')
  )
  select
    h.school,
    h.department,
    case
      when h.reason_category in (
        'compensation', 'career_growth', 'workload', 'management',
        'work_environment', 'relocation', 'personal', 'retirement',
        'contract_end', 'health', 'education', 'other'
      ) then h.reason_category
      else 'other'
    end,
    count(*)::bigint
  from exit_history h
  where (select public.hrms_role()) in ('administrator', 'hr', 'hr_manager')
    and (p_from is null or h.exit_date >= p_from)
    and (p_to is null or h.exit_date <= p_to)
    and (p_department is null or h.department = p_department)
  group by h.school, h.department, 3
  order by count(*) desc, h.school, h.department;
$$;

revoke all on function public.get_turnover_baseline_filtered(date, date, text) from public, anon;
grant execute on function public.get_turnover_baseline_filtered(date, date, text) to authenticated;
