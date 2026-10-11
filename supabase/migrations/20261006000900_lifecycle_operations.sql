alter table public.employees
  add column if not exists home_area text,
  add column if not exists commute_distance_km numeric(7, 2),
  add column if not exists is_technical boolean not null default false,
  add column if not exists user_id uuid references auth.users(id);

alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.exit_requests
  add column if not exists submitted_on timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists finalized_by uuid references auth.users(id);

update public.employees e
set user_id = u.id
from auth.users u
where e.user_id is null
  and lower(e.email) = lower(u.email)
  and (
    select count(*)
    from public.employees same_email
    where lower(same_email.email) = lower(e.email)
  ) = 1;

create unique index if not exists employees_user_id_idx
  on public.employees(user_id)
  where user_id is not null;

alter table public.employees
  drop constraint if exists employees_commute_distance_nonnegative;

alter table public.employees
  add constraint employees_commute_distance_nonnegative
  check (commute_distance_km is null or commute_distance_km >= 0);

alter table public.assets
  add column if not exists current_location text;

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_status_chk;

alter table public.knowledge_documents
  add constraint knowledge_documents_status_chk
  check (status in ('pending', 'submitted', 'pending_review', 'revision_required', 'approved', 'verified', 'rejected'));

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

create table if not exists public.retention_interventions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  risk_score integer not null,
  intervention_type text not null,
  action_notes text not null,
  follow_up_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint retention_interventions_score_valid check (risk_score between 0 and 100),
  constraint retention_interventions_type_valid
    check (intervention_type in ('career_conversation', 'workload_review', 'development', 'commute_support', 'other'))
);

create index if not exists retention_interventions_employee_date_idx
  on public.retention_interventions(employee_id, created_at desc);

create table if not exists public.quarterly_turnover_reports (
  quarter_start date not null,
  department text not null,
  exits integer not null,
  active_headcount integer not null,
  top_exit_reason text,
  attrition_rate_pct numeric(5, 1),
  generated_at timestamptz not null default now(),
  primary key (quarter_start, department)
);

alter table public.quarterly_turnover_reports
  add column if not exists top_exit_reason text;

alter table public.quarterly_turnover_reports enable row level security;
drop policy if exists authenticated_users_read_quarterly_reports on public.quarterly_turnover_reports;
create policy authenticated_users_read_quarterly_reports
  on public.quarterly_turnover_reports for select
  using (auth.uid() is not null);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select lower(role) from public.profiles where id = auth.uid() and active = true),
    'employee'
  );
$$;

revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

insert into public.role_permissions (role_name, permission_name)
values
  ('Academic Attaché', 'view_own_profile'),
  ('Academic Attaché', 'apply_for_leave'),
  ('Academic Attaché', 'view_own_leave'),
  ('Support Staff', 'view_own_profile'),
  ('Support Staff', 'apply_for_leave'),
  ('Support Staff', 'view_own_leave')
on conflict (role_name, permission_name) do nothing;

alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.asset_daily_logs enable row level security;
alter table public.recruitment_openings enable row level security;
alter table public.retention_interventions enable row level security;

drop policy if exists authenticated_users_access_leave_requests on public.leave_requests;
drop policy if exists leave_requests_read_scope on public.leave_requests;
drop policy if exists leave_requests_insert_self on public.leave_requests;
drop policy if exists leave_requests_review_hr on public.leave_requests;
create policy leave_requests_read_scope on public.leave_requests
  for select using (
    public.current_app_role() in ('administrator', 'hr')
    or exists (
      select 1 from public.employees e
      where e.id = leave_requests.employee_id and e.user_id = auth.uid()
    )
  );
create policy leave_requests_insert_self on public.leave_requests
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = leave_requests.employee_id and e.user_id = auth.uid()
    )
  );
create policy leave_requests_review_hr on public.leave_requests
  for update
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

drop policy if exists authenticated_users_access_leave_balances on public.leave_balances;
drop policy if exists leave_balances_read_scope on public.leave_balances;
drop policy if exists leave_balances_manage_hr on public.leave_balances;
create policy leave_balances_read_scope on public.leave_balances
  for select using (
    public.current_app_role() in ('administrator', 'hr')
    or exists (
      select 1 from public.employees e
      where e.id = leave_balances.employee_id and e.user_id = auth.uid()
    )
  );
create policy leave_balances_manage_hr on public.leave_balances
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

drop policy if exists authenticated_users_access_asset_daily_logs on public.asset_daily_logs;
drop policy if exists asset_daily_logs_read_roles on public.asset_daily_logs;
drop policy if exists asset_daily_logs_insert_roles on public.asset_daily_logs;
create policy asset_daily_logs_read_roles on public.asset_daily_logs
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
  );
create policy asset_daily_logs_insert_roles on public.asset_daily_logs
  for insert with check (
    public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
  );

drop policy if exists authenticated_users_access_recruitment_openings on public.recruitment_openings;
drop policy if exists recruitment_openings_read_roles on public.recruitment_openings;
drop policy if exists recruitment_openings_manage_roles on public.recruitment_openings;
create policy recruitment_openings_read_roles on public.recruitment_openings
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
  );
create policy recruitment_openings_manage_roles on public.recruitment_openings
  for all
  using (public.current_app_role() in ('administrator', 'hr', 'management'))
  with check (public.current_app_role() in ('administrator', 'hr', 'management'));

drop policy if exists retention_interventions_read_roles on public.retention_interventions;
drop policy if exists retention_interventions_manage_hr on public.retention_interventions;
create policy retention_interventions_read_roles on public.retention_interventions
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
  );
create policy retention_interventions_manage_hr on public.retention_interventions
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

drop policy if exists authenticated_users_read_quarterly_reports on public.quarterly_turnover_reports;
create policy authenticated_users_read_quarterly_reports
  on public.quarterly_turnover_reports for select
  using (
    public.current_app_role() in ('administrator', 'hr', 'management')
  );

create or replace view public.quarterly_turnover_summary
with (security_invoker = false)
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
quarter_reason_counts as (
  select
    date_trunc('quarter', coalesce(e.exit_date, er.completed_at, er.submitted_on, er.created_at))::date as quarter_start,
    coalesce(d.name, 'Unassigned') as department,
    coalesce(nullif(trim(er.reason), ''), 'Not specified') as exit_reason,
    count(*) as reason_count
  from public.exit_requests er
  join public.employees e on e.id = er.employee_id
  left join public.departments d on d.id = e.department_id
  where (er.status = 'completed' or e.employment_status = 'exited')
    and coalesce(e.exit_date, er.completed_at, er.submitted_on, er.created_at) is not null
  group by 1, 2, 3
),
quarter_top_reason as (
  select quarter_start, department, exit_reason
  from (
    select
      quarter_start,
      department,
      exit_reason,
      row_number() over (
        partition by quarter_start, department
        order by reason_count desc, exit_reason
      ) as reason_rank
    from quarter_reason_counts
  ) ranked_reasons
  where reason_rank = 1
),
quarter_series as (
  select generate_series(
    date_trunc('quarter', current_date) - interval '21 months',
    date_trunc('quarter', current_date),
    interval '3 months'
  )::date as quarter_start
),
department_scope as (
  select distinct e.department_id, coalesce(d.name, 'Unassigned') as department
  from public.employees e
  left join public.departments d on d.id = e.department_id
),
quarter_workforce as (
  select
    qs.quarter_start,
    ds.department,
    round((
      count(e.id) filter (
        where coalesce(e.joined_on::date, e.created_at::date) <= qs.quarter_start
          and (e.exit_date is null or e.exit_date::date >= qs.quarter_start)
      )
      +
      count(e.id) filter (
        where coalesce(e.joined_on::date, e.created_at::date)
            <= (qs.quarter_start + interval '3 months' - interval '1 day')::date
          and (
            e.exit_date is null
            or e.exit_date::date >= (qs.quarter_start + interval '3 months' - interval '1 day')::date
          )
      )
    ) / 2.0)::bigint as active_headcount
  from quarter_series qs
  cross join department_scope ds
  left join public.employees e on e.department_id is not distinct from ds.department_id
  group by qs.quarter_start, ds.department
)
select
  qs.quarter_start,
  w.department,
  coalesce(q.exits, 0) as exits,
  w.active_headcount,
  round((coalesce(q.exits, 0) * 100.0 / nullif(w.active_headcount, 0))::numeric, 1) as attrition_rate_pct,
  r.exit_reason as top_exit_reason
from quarter_series qs
join quarter_workforce w on w.quarter_start = qs.quarter_start
left join quarter_exits q
  on q.quarter_start = qs.quarter_start
  and q.department = w.department
left join quarter_top_reason r
  on r.quarter_start = qs.quarter_start
  and r.department = w.department;

revoke all on public.quarterly_turnover_summary from public, anon, authenticated;

create or replace function public.get_quarterly_turnover_summary()
returns table (
  quarter_start date,
  department text,
  exits bigint,
  active_headcount integer,
  top_exit_reason text,
  attrition_rate_pct numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_app_role() not in ('administrator', 'hr', 'management') then
    raise exception 'Not authorized to view quarterly turnover reports';
  end if;
  return query
    select
      summary.quarter_start,
      summary.department,
      summary.exits,
      summary.active_headcount::integer,
      summary.top_exit_reason,
      summary.attrition_rate_pct
    from public.quarterly_turnover_summary summary;
end;
$$;

revoke execute on function public.get_quarterly_turnover_summary() from public, anon;
grant execute on function public.get_quarterly_turnover_summary() to authenticated;

create or replace function public.capture_quarterly_turnover_report()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quarter_start date := (date_trunc('quarter', current_date) - interval '3 months')::date;
begin
  insert into public.quarterly_turnover_reports (
    quarter_start,
    department,
    exits,
    active_headcount,
    top_exit_reason,
    attrition_rate_pct,
    generated_at
  )
  select
    quarter_start,
    department,
    exits::integer,
    active_headcount::integer,
    top_exit_reason,
    attrition_rate_pct,
    now()
  from public.quarterly_turnover_summary
  where quarter_start = v_quarter_start
  on conflict (quarter_start, department) do update
  set exits = excluded.exits,
      active_headcount = excluded.active_headcount,
  top_exit_reason = excluded.top_exit_reason,
      attrition_rate_pct = excluded.attrition_rate_pct,
      generated_at = excluded.generated_at;
end;
$$;

revoke execute on function public.capture_quarterly_turnover_report() from public, anon, authenticated;

do $schedule$
begin
  if exists (select 1 from cron.job where jobname = 'quarterly-turnover-report') then
    perform cron.unschedule('quarterly-turnover-report');
  end if;

  perform cron.schedule(
    'quarterly-turnover-report',
    '0 6 1 1,4,7,10 *',
    $job$select public.capture_quarterly_turnover_report();$job$
  );
end;
$schedule$;

create or replace function public.can_finalize_exit(p_exit_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blockers jsonb := '[]'::jsonb;
  v_exit record;
  v_step record;
  v_asset record;
  v_requirement record;
  v_requirement_count integer := 0;
  v_approved_document_count integer := 0;
begin
  select er.id, er.employee_id, e.department_id, e.employment_category, e.is_technical
  into v_exit
  from public.exit_requests er
  join public.employees e on e.id = er.employee_id
  where er.id = p_exit_request_id;

  if not found then
    raise exception 'Exit request or employee not found';
  end if;

  for v_step in
    select department, status, comments
    from public.clearance_steps
    where exit_request_id = p_exit_request_id
      and status <> 'approved'
  loop
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'clearance',
      'department', v_step.department,
      'message', coalesce(v_step.comments, 'Clearance pending for ' || v_step.department)
    );
  end loop;

  for v_asset in
    select id, asset_tag
    from public.assets
    where assigned_to = v_exit.employee_id
      and (status <> 'verified' or returned_at is null or verified_at is null)
  loop
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'asset',
      'asset_id', v_asset.id,
      'asset_tag', v_asset.asset_tag,
      'message', 'Asset ' || v_asset.asset_tag || ' must be received and return-verified.'
    );
  end loop;

  for v_requirement in
    select kr.id, kr.name
    from public.knowledge_requirements kr
    where kr.active = true
      and kr.is_required = true
      and (kr.department_id is null or kr.department_id = v_exit.department_id)
      and (kr.employment_category is null or kr.employment_category = v_exit.employment_category)
  loop
    v_requirement_count := v_requirement_count + 1;
    if not exists (
      select 1
      from public.knowledge_documents kd
      where kd.employee_id = v_exit.employee_id
        and kd.requirement_id = v_requirement.id
        and kd.status in ('approved', 'verified')
    ) then
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'knowledge',
        'requirement_id', v_requirement.id,
        'message', 'Required knowledge handover is missing or unapproved: ' || v_requirement.name
      );
    end if;
  end loop;

  if v_exit.is_technical then
    select count(*)
    into v_approved_document_count
    from public.knowledge_documents kd
    where kd.employee_id = v_exit.employee_id
      and kd.status in ('approved', 'verified');

    if v_requirement_count = 0 then
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'knowledge',
        'message', 'No mandatory knowledge requirements are configured for this technical employee.'
      );
    end if;
    if v_approved_document_count = 0 then
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'knowledge',
        'message', 'Technical staff must upload at least one approved knowledge handover document.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'eligible', jsonb_array_length(v_blockers) = 0,
    'blocked', jsonb_array_length(v_blockers) > 0,
    'blockers', v_blockers
  );
end;
$$;

create or replace function public.finalize_exit(p_exit_request_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_check jsonb;
  v_employee_id uuid;
begin
  if auth.uid() is null or p_actor_id <> auth.uid() then
    raise exception 'Authenticated actor does not match the requested actor';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('administrator', 'hr')
      and active = true
  ) then
    raise exception 'Only active HR users or administrators can finalize exits';
  end if;

  select employee_id
  into v_employee_id
  from public.exit_requests
  where id = p_exit_request_id
  for update;
  if not found then
    raise exception 'Exit request not found';
  end if;

  v_check := public.can_finalize_exit(p_exit_request_id);
  if v_check->>'eligible' <> 'true' then
    insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (
      p_actor_id,
      'finalization_blocked',
      'exit_request',
      p_exit_request_id::text,
      jsonb_build_object('blockers', v_check->'blockers')
    );
    return jsonb_build_object('success', false, 'blockers', v_check->'blockers');
  end if;

  update public.exit_requests
  set status = 'completed',
      completed_at = now(),
      finalized_by = p_actor_id,
      updated_at = now()
  where id = p_exit_request_id;

  update public.employees
  set employment_status = 'exited',
      exit_date = now(),
      updated_at = now()
  where id = v_employee_id;

  insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id,
    'finalized',
    'exit_request',
    p_exit_request_id::text,
    jsonb_build_object('employee_id', v_employee_id)
  );

  perform public.create_notification(
    p_actor_id,
    'success',
    'Exit finalized',
    'The exit request has been completed and the employee status updated.',
    'exit_request',
    p_exit_request_id::text
  );

  return jsonb_build_object('success', true, 'exit_request_id', p_exit_request_id);
end;
$$;
