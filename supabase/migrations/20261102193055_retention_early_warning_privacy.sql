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
security definer
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
      past.exit_date,
      coalesce(d.name, 'Unassigned') as department,
      case lower(btrim(past.reason_category))
        when 'compensation' then 'compensation'
        when 'career_growth' then 'career_growth'
        when 'workload' then 'workload'
        when 'management' then 'management'
        when 'work_environment' then 'work_environment'
        when 'relocation' then 'relocation'
        when 'personal' then 'personal'
        when 'retirement' then 'retirement'
        when 'contract_end' then 'contract_end'
        when 'health' then 'health'
        when 'education' then 'education'
        when 'other' then 'other'
        else 'other'
      end as reason
    from public.past_exit_records past
    join public.employees e on e.id = past.employee_id
    left join public.departments d on d.id = coalesce(past.department_id, e.department_id)
    union all
    select
      coalesce(ec.last_day, ec.completed_at::date, e.exit_date, ec.created_at::date),
      coalesce(d.name, 'Unassigned'),
      case lower(btrim(coalesce(sr.reason, ec.reason_category, '')))
        when 'compensation' then 'compensation'
        when 'career_growth' then 'career_growth'
        when 'workload' then 'workload'
        when 'management' then 'management'
        when 'work_environment' then 'work_environment'
        when 'relocation' then 'relocation'
        when 'personal' then 'personal'
        when 'retirement' then 'retirement'
        when 'contract_end' then 'contract_end'
        when 'health' then 'health'
        when 'education' then 'education'
        when 'other' then 'other'
        else 'other'
      end
    from public.exit_cases ec
    join public.employees e on e.id = ec.employee_id
    left join public.departments d on d.id = e.department_id
    left join (
      select distinct on (i.exit_case_id)
        i.exit_case_id,
        nullif(btrim(r.answers->>'main_reason'), '') as reason
      from public.post_exit_survey_invitations i
      join public.post_exit_survey_responses r on r.invitation_id = i.id
      where nullif(btrim(r.answers->>'main_reason'), '') is not null
      order by i.exit_case_id, r.submitted_at desc
    ) sr on sr.exit_case_id = ec.id
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
      and x.exit_date <= current_date
    group by q.quarter_start, x.department, x.reason
  ),
  totals as (
    select q.quarter_start, x.department, count(*) as exits
    from quarters q
    join exits x on x.exit_date between q.quarter_start and q.quarter_end
      and x.exit_date <= current_date
    group by q.quarter_start, x.department
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
  department_periods as (
    select quarter_start, department from totals
    union
    select quarter_start, department from headcounts
  )
  select
    p.quarter_start,
    p.department,
    coalesce(t.exits, 0)::bigint,
    round((coalesce(h.start_headcount, 0) + coalesce(h.end_headcount, 0))::numeric / 2, 1),
    case when coalesce(h.start_headcount, 0) + coalesce(h.end_headcount, 0) = 0 then null
      else round(
        coalesce(t.exits, 0)::numeric * 100 /
        ((h.start_headcount + h.end_headcount)::numeric / 2),
        1
      )
    end,
    r.reason
  from department_periods p
  left join totals t on t.quarter_start = p.quarter_start and t.department = p.department
  left join headcounts h on h.quarter_start = p.quarter_start and h.department = p.department
  left join grouped_reasons r
    on r.quarter_start = p.quarter_start
    and r.department = p.department
    and r.reason_rank = 1
    and r.reason_count >= 5
  where (select public.hrms_role()) in ('administrator', 'hr', 'hr_manager')
    and coalesce(h.start_headcount, 0) >= 5
    and coalesce(h.end_headcount, 0) >= 5
    and (coalesce(t.exits, 0) = 0 or coalesce(t.exits, 0) >= 5)
  order by p.quarter_start desc, p.department;
$$;

revoke all on function public.get_quarterly_turnover_summary()
  from public, anon;
grant execute on function public.get_quarterly_turnover_summary()
  to authenticated;

create or replace function public.get_turnover_baseline()
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
      coalesce(d.school, 'Not recorded') as school,
      coalesce(d.name, 'Unassigned') as department,
      case lower(btrim(past.reason_category))
        when 'compensation' then 'compensation'
        when 'career_growth' then 'career_growth'
        when 'workload' then 'workload'
        when 'management' then 'management'
        when 'work_environment' then 'work_environment'
        when 'relocation' then 'relocation'
        when 'personal' then 'personal'
        when 'retirement' then 'retirement'
        when 'contract_end' then 'contract_end'
        when 'health' then 'health'
        when 'education' then 'education'
        when 'other' then 'other'
        else 'other'
      end as reason_category
    from public.past_exit_records past
    join public.employees e on e.id = past.employee_id
    left join public.departments d on d.id = coalesce(past.department_id, e.department_id)
    union all
    select
      coalesce(d.school, 'Not recorded'),
      coalesce(d.name, 'Unassigned'),
      case lower(btrim(coalesce(sr.reason, ec.reason_category, '')))
        when 'compensation' then 'compensation'
        when 'career_growth' then 'career_growth'
        when 'workload' then 'workload'
        when 'management' then 'management'
        when 'work_environment' then 'work_environment'
        when 'relocation' then 'relocation'
        when 'personal' then 'personal'
        when 'retirement' then 'retirement'
        when 'contract_end' then 'contract_end'
        when 'health' then 'health'
        when 'education' then 'education'
        when 'other' then 'other'
        else 'other'
      end
    from public.exit_cases ec
    join public.employees e on e.id = ec.employee_id
    left join public.departments d on d.id = e.department_id
    left join (
      select distinct on (i.exit_case_id)
        i.exit_case_id,
        nullif(btrim(r.answers->>'main_reason'), '') as reason
      from public.post_exit_survey_invitations i
      join public.post_exit_survey_responses r on r.invitation_id = i.id
      where nullif(btrim(r.answers->>'main_reason'), '') is not null
      order by i.exit_case_id, r.submitted_at desc
    ) sr on sr.exit_case_id = ec.id
    where lower(ec.status) in ('completed', 'finalized')
  )
  select
    h.school,
    h.department,
    h.reason_category,
    count(*)::bigint
  from exit_history h
  where (select public.hrms_role()) in ('administrator', 'hr', 'hr_manager')
  group by h.school, h.department, h.reason_category
  having count(*) >= 5
  order by count(*) desc, h.school, h.department;
$$;

revoke all on function public.get_turnover_baseline() from public, anon;
grant execute on function public.get_turnover_baseline() to authenticated;

create or replace function public.get_turnover_report_export(
  p_from date default null,
  p_to date default null,
  p_department text default null
)
returns table (
  quarter_start date,
  department text,
  reportable_exits bigint,
  active_headcount numeric,
  attrition_rate_pct numeric,
  top_exit_reason text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select public.hrms_role()) not in ('hr', 'hr_manager') then
    raise exception 'Only HR staff can export turnover reports.';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'The report start date must be before its end date.';
  end if;

  return query
  select
    report.quarter_start,
    report.department,
    report.exits,
    report.active_headcount,
    report.attrition_rate_pct,
    report.top_exit_reason
  from public.get_quarterly_turnover_summary() report
  where (p_from is null or (report.quarter_start + interval '3 months - 1 day')::date >= p_from)
    and (p_to is null or report.quarter_start <= p_to)
    and (
      nullif(btrim(p_department), '') is null
      or lower(report.department) = lower(btrim(p_department))
    )
  order by report.quarter_start, report.department;
end;
$$;

revoke all on function public.get_turnover_report_export(date, date, text)
  from public, anon;
grant execute on function public.get_turnover_report_export(date, date, text)
  to authenticated;

create table if not exists public.retention_analysis_baselines (
  department text primary key,
  baseline_rate_pct numeric(8, 2) not null check (baseline_rate_pct >= 0),
  warning_threshold_pct numeric(8, 2) not null check (warning_threshold_pct >= 0),
  completed_quarters integer not null check (completed_quarters >= 2),
  calculated_at timestamptz not null default now(),
  calculated_by uuid not null references auth.users(id)
);

create table if not exists public.early_warning_flags (
  id uuid primary key default gen_random_uuid(),
  quarter_start date not null,
  department text not null,
  current_rate_pct numeric(8, 2) not null check (current_rate_pct >= 0),
  baseline_rate_pct numeric(8, 2) not null check (baseline_rate_pct >= 0),
  warning_threshold_pct numeric(8, 2) not null check (warning_threshold_pct >= 0),
  active_headcount numeric(8, 1) not null check (active_headcount >= 5),
  average_tenure_months numeric(8, 1),
  engagement_score numeric(3, 1) check (engagement_score between 1 and 5),
  engagement_respondents integer check (
    engagement_respondents is null or engagement_respondents >= 5
  ),
  explanation text not null,
  status text not null default 'open' check (status in ('open', 'cleared')),
  raised_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quarter_start, department)
);

create index if not exists early_warning_flags_open_idx
  on public.early_warning_flags (quarter_start desc, department)
  where status = 'open';

alter table public.retention_analysis_baselines enable row level security;
alter table public.early_warning_flags enable row level security;

drop policy if exists "hr read retention analysis baselines"
  on public.retention_analysis_baselines;
create policy "hr read retention analysis baselines"
  on public.retention_analysis_baselines for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));

drop policy if exists "hr read early warning flags"
  on public.early_warning_flags;
create policy "hr read early warning flags"
  on public.early_warning_flags for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));

revoke all on table public.retention_analysis_baselines,
  public.early_warning_flags from public, anon, authenticated;
grant select on table public.retention_analysis_baselines,
  public.early_warning_flags to authenticated;
grant all on table public.retention_analysis_baselines,
  public.early_warning_flags to service_role;

create or replace function public.get_retention_early_warning_candidates()
returns table (
  quarter_start date,
  department text,
  current_rate_pct numeric,
  baseline_rate_pct numeric,
  warning_threshold_pct numeric,
  active_headcount numeric,
  average_tenure_months numeric,
  engagement_score numeric,
  engagement_respondents integer,
  explanation text
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_rates as (
    select report.*
    from public.get_quarterly_turnover_summary() report
    where report.quarter_start = date_trunc('quarter', current_date)::date
      and report.exits >= 5
      and report.attrition_rate_pct is not null
  ),
  tenure as (
    select
      coalesce(d.name, 'Unassigned') as department,
      round(avg(
        (current_date - coalesce(e.joined_on, e.appointment_date, e.created_at::date))::numeric
        / 30.4375
      ), 1) as average_tenure_months
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.employment_status <> 'exited'
    group by coalesce(d.name, 'Unassigned')
  ),
  employee_engagement as (
    select
      e.id as employee_id,
      coalesce(d.name, 'Unassigned') as department,
      avg(answer.value::numeric) as employee_score
    from public.survey_responses response
    join public.employees e on e.id = response.employee_id
    left join public.departments d on d.id = e.department_id
    cross join lateral jsonb_each_text(response.answers) as answer(key, value)
    where response.submitted_at >= now() - interval '180 days'
      and e.employment_status <> 'exited'
      and answer.value ~ '^[1-5]$'
    group by e.id, coalesce(d.name, 'Unassigned')
  ),
  department_engagement as (
    select
      employee_engagement.department,
      round(avg(employee_engagement.employee_score), 1) as engagement_score,
      count(*)::integer as respondents
    from employee_engagement
    group by employee_engagement.department
    having count(*) >= 5
  ),
  candidates as (
    select
      current_rates.quarter_start,
      current_rates.department,
      current_rates.attrition_rate_pct as current_rate_pct,
      baseline.baseline_rate_pct,
      baseline.warning_threshold_pct,
      current_rates.active_headcount,
      tenure.average_tenure_months,
      department_engagement.engagement_score,
      department_engagement.respondents as engagement_respondents
    from current_rates
    join public.retention_analysis_baselines baseline
      on baseline.department = current_rates.department
    left join tenure on tenure.department = current_rates.department
    left join department_engagement
      on department_engagement.department = current_rates.department
    where current_rates.attrition_rate_pct >= baseline.warning_threshold_pct
      and (select auth.uid()) is not null
      and (select public.hrms_role()) in ('hr', 'hr_manager')
  )
  select
    candidates.quarter_start,
    candidates.department,
    candidates.current_rate_pct,
    candidates.baseline_rate_pct,
    candidates.warning_threshold_pct,
    candidates.active_headcount,
    candidates.average_tenure_months,
    candidates.engagement_score,
    candidates.engagement_respondents,
    format(
      'Quarter-to-date attrition is %s%% against a completed-quarter baseline of %s%% (25%% warning threshold: %s%%). Average active-staff tenure: %s. %s',
      candidates.current_rate_pct,
      candidates.baseline_rate_pct,
      candidates.warning_threshold_pct,
      coalesce(candidates.average_tenure_months::text || ' months', 'not available'),
      case
        when candidates.engagement_respondents is null then
          'Recent engagement aggregate withheld because fewer than five employees responded.'
        else format(
          'Recent engagement average: %s/5 across %s respondents.',
          candidates.engagement_score,
          candidates.engagement_respondents
        )
      end
    )
  from candidates
  order by candidates.current_rate_pct desc, candidates.department;
$$;

revoke all on function public.get_retention_early_warning_candidates()
  from public, anon, authenticated;

create or replace function public.compute_retention_baseline()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_department_count integer;
begin
  if v_actor_id is null
    or (select public.hrms_role()) not in ('hr', 'hr_manager') then
    raise exception 'Only signed-in HR staff can compute the retention baseline.';
  end if;

  with completed_rates as (
    select
      report.department,
      avg(report.attrition_rate_pct) as baseline_rate_pct,
      count(*)::integer as completed_quarters
    from public.get_quarterly_turnover_summary() report
    where report.quarter_start < date_trunc('quarter', current_date)::date
      and report.attrition_rate_pct is not null
    group by report.department
    having count(*) >= 2
  ),
  saved as (
    insert into public.retention_analysis_baselines (
      department,
      baseline_rate_pct,
      warning_threshold_pct,
      completed_quarters,
      calculated_at,
      calculated_by
    )
    select
      completed_rates.department,
      round(completed_rates.baseline_rate_pct, 2),
      round(completed_rates.baseline_rate_pct * 1.25, 2),
      completed_rates.completed_quarters,
      now(),
      v_actor_id
    from completed_rates
    on conflict (department) do update
      set baseline_rate_pct = excluded.baseline_rate_pct,
          warning_threshold_pct = excluded.warning_threshold_pct,
          completed_quarters = excluded.completed_quarters,
          calculated_at = excluded.calculated_at,
          calculated_by = excluded.calculated_by
    returning department
  )
  select count(*)::integer into v_department_count from saved;

  if v_department_count = 0 then
    raise exception 'At least two reportable completed quarters are required for a department baseline.';
  end if;

  delete from public.retention_analysis_baselines baseline
  where not exists (
    select 1
    from public.get_quarterly_turnover_summary() report
    where report.department = baseline.department
      and report.quarter_start < date_trunc('quarter', current_date)::date
      and report.attrition_rate_pct is not null
    group by report.department
    having count(*) >= 2
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'computed',
    'retention_analysis_baseline',
    null,
    jsonb_build_object('department_count', v_department_count, 'threshold_multiplier', 1.25)
  );

  return v_department_count;
end;
$$;

revoke all on function public.compute_retention_baseline() from public, anon;
grant execute on function public.compute_retention_baseline() to authenticated;

create or replace function public.refresh_early_warning_flags()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_flag_count integer;
  v_current_quarter date := date_trunc('quarter', current_date)::date;
begin
  if v_actor_id is null
    or (select public.hrms_role()) not in ('hr', 'hr_manager') then
    raise exception 'Only signed-in HR staff can refresh early-warning analysis.';
  end if;

  if not exists (select 1 from public.retention_analysis_baselines) then
    raise exception 'Compute a reportable baseline before refreshing early-warning analysis.';
  end if;

  update public.early_warning_flags flag
  set status = 'cleared',
      updated_at = now()
  where flag.status = 'open'
    and (
      flag.quarter_start <> v_current_quarter
      or not exists (
        select 1
        from public.get_retention_early_warning_candidates() candidate
        where candidate.quarter_start = flag.quarter_start
          and candidate.department = flag.department
      )
    );

  with refreshed as (
    insert into public.early_warning_flags (
      quarter_start,
      department,
      current_rate_pct,
      baseline_rate_pct,
      warning_threshold_pct,
      active_headcount,
      average_tenure_months,
      engagement_score,
      engagement_respondents,
      explanation,
      status,
      updated_at
    )
    select
      candidate.quarter_start,
      candidate.department,
      candidate.current_rate_pct,
      candidate.baseline_rate_pct,
      candidate.warning_threshold_pct,
      candidate.active_headcount,
      candidate.average_tenure_months,
      candidate.engagement_score,
      candidate.engagement_respondents,
      candidate.explanation,
      'open',
      now()
    from public.get_retention_early_warning_candidates() candidate
    on conflict (quarter_start, department) do update
      set current_rate_pct = excluded.current_rate_pct,
          baseline_rate_pct = excluded.baseline_rate_pct,
          warning_threshold_pct = excluded.warning_threshold_pct,
          active_headcount = excluded.active_headcount,
          average_tenure_months = excluded.average_tenure_months,
          engagement_score = excluded.engagement_score,
          engagement_respondents = excluded.engagement_respondents,
          explanation = excluded.explanation,
          status = 'open',
          raised_at = case
            when public.early_warning_flags.status = 'open'
              then public.early_warning_flags.raised_at
            else now()
          end,
          updated_at = now()
    returning id
  )
  select count(*)::integer into v_flag_count from refreshed;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'refreshed',
    'early_warning_flags',
    null,
    jsonb_build_object(
      'quarter_start', v_current_quarter,
      'open_flag_count', v_flag_count
    )
  );

  return v_flag_count;
end;
$$;

revoke all on function public.refresh_early_warning_flags() from public, anon;
grant execute on function public.refresh_early_warning_flags() to authenticated;