alter table public.employees
  add column if not exists phone text,
  add column if not exists employment_category text,
  add column if not exists joined_on date,
  add column if not exists home_area text,
  add column if not exists commute_distance_km numeric(8, 2),
  add column if not exists is_technical boolean not null default false;

alter table public.notifications
  add column if not exists type text,
  add column if not exists entity_type text,
  add column if not exists entity_id text;

alter table public.exit_cases
  add column if not exists submitted_on timestamptz,
  add column if not exists clearance_departments text[] not null default '{}';

update public.exit_cases
set submitted_on = created_at
where submitted_on is null;

alter table public.exit_cases
  alter column submitted_on set default now(),
  alter column submitted_on set not null;

create table if not exists public.recruitment_openings (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  employment_category text not null,
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'planned'
    check (status in ('planned', 'open', 'shortlisting', 'interviewing', 'offered', 'filled', 'cancelled')),
  positions integer not null default 1 check (positions > 0),
  target_start_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.retention_interventions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  intervention_type text not null
    check (intervention_type in ('career_conversation', 'workload_review', 'development', 'commute_support', 'other')),
  action_notes text not null,
  follow_up_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.clearance_steps (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references public.exit_cases(id) on delete cascade,
  department text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'approved', 'blocked')),
  step_order smallint not null default 0 check (step_order >= 0),
  comments text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exit_request_id, department)
);

create table if not exists public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references public.exit_cases(id) on delete cascade,
  interviewer_id uuid references auth.users(id) on delete set null,
  scheduled_for timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists recruitment_openings_department_created_idx
  on public.recruitment_openings (department_id, created_at desc);
create index if not exists retention_interventions_employee_created_idx
  on public.retention_interventions (employee_id, created_at desc);
create index if not exists clearance_steps_exit_order_idx
  on public.clearance_steps (exit_request_id, step_order);
create index if not exists exit_interviews_exit_created_idx
  on public.exit_interviews (exit_request_id, created_at desc);

alter table public.recruitment_openings enable row level security;
alter table public.retention_interventions enable row level security;
alter table public.clearance_steps enable row level security;
alter table public.exit_interviews enable row level security;

drop policy if exists "recruitment openings read" on public.recruitment_openings;
create policy "recruitment openings read"
  on public.recruitment_openings for select
  using (public.hrms_is_hr());
drop policy if exists "recruitment openings manage" on public.recruitment_openings;
create policy "recruitment openings manage"
  on public.recruitment_openings for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

drop policy if exists "retention interventions read" on public.retention_interventions;
create policy "retention interventions read"
  on public.retention_interventions for select
  using (public.hrms_is_hr());
drop policy if exists "retention interventions manage" on public.retention_interventions;
create policy "retention interventions manage"
  on public.retention_interventions for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

drop policy if exists "clearance steps read" on public.clearance_steps;
create policy "clearance steps read"
  on public.clearance_steps for select
  using (
    public.hrms_is_hr()
    or exists (
      select 1
      from public.exit_cases x
      join public.employees e on e.id = x.employee_id
      where x.id = public.clearance_steps.exit_request_id
        and e.user_id = auth.uid()
    )
  );
drop policy if exists "clearance steps manage" on public.clearance_steps;
create policy "clearance steps manage"
  on public.clearance_steps for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

drop policy if exists "exit interviews read" on public.exit_interviews;
create policy "exit interviews read"
  on public.exit_interviews for select
  using (public.hrms_is_hr());
drop policy if exists "exit interviews manage" on public.exit_interviews;
create policy "exit interviews manage"
  on public.exit_interviews for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

grant select, insert, update, delete on public.recruitment_openings to authenticated;
grant select, insert, update, delete on public.retention_interventions to authenticated;
grant select, insert, update, delete on public.clearance_steps to authenticated;
grant select, insert, update, delete on public.exit_interviews to authenticated;
grant all privileges on public.recruitment_openings to service_role;
grant all privileges on public.retention_interventions to service_role;
grant all privileges on public.clearance_steps to service_role;
grant all privileges on public.exit_interviews to service_role;

create or replace view public.knowledge_review_employee_directory
with (security_invoker = true)
as
select id, full_name, employee_number
from public.employees;

grant select on public.knowledge_review_employee_directory to authenticated, service_role;

create or replace function public.can_review_knowledge_document(
  p_employee_id uuid,
  p_requirement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      left join public.knowledge_requirements r
        on r.id = p_requirement_id
      where p.id = auth.uid()
        and p.active = true
        and (
          p.role in ('administrator', 'hr', 'hr_manager')
          or lower(trim(coalesce(r.reviewer_role, ''))) = lower(trim(p.role))
        )
    )
    and exists (
      select 1
      from public.employees e
      where e.id = p_employee_id
    );
$$;

revoke all on function public.can_review_knowledge_document(uuid, uuid)
  from public, anon;
grant execute on function public.can_review_knowledge_document(uuid, uuid)
  to authenticated, service_role;

create or replace function public.get_leave_processing_target_metrics()
returns table (
  baseline_days numeric,
  current_average_days numeric,
  reviewed_request_count bigint,
  pending_request_count bigint,
  reduction_percent numeric,
  measurement_start date,
  measurement_end date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_start date := (current_date - interval '6 months')::date;
  window_end date := current_date;
begin
  if not public.hrms_is_hr() then
    raise exception 'You are not authorized to view leave processing metrics.';
  end if;

  return query
  with settings as (
    select
      max(s.value) filter (where s.key = 'leave_processing_baseline_days') as baseline_value
    from public.system_settings s
  ),
  measures as (
    select
      avg(extract(epoch from (lr.reviewed_at - lr.created_at)) / 86400.0)
        filter (
          where lr.reviewed_at is not null
            and lr.reviewed_at::date between window_start and window_end
        ) as average_days,
      count(*) filter (
        where lr.reviewed_at is not null
          and lr.reviewed_at::date between window_start and window_end
      ) as reviewed_count,
      count(*) filter (
        where lower(lr.status) = 'pending'
          and lr.created_at::date between window_start and window_end
      ) as pending_count
    from public.leave_requests lr
  ),
  baseline as (
    select case
      when settings.baseline_value ~ '^[0-9]+([.][0-9]+)?$'
        then settings.baseline_value::numeric
      else null
    end as value
    from settings
  )
  select
    baseline.value,
    round(measures.average_days::numeric, 1),
    measures.reviewed_count,
    measures.pending_count,
    case
      when baseline.value is null
        or baseline.value <= 0
        or measures.average_days is null
      then null
      else round(
        ((baseline.value - measures.average_days::numeric) / baseline.value) * 100,
        1
      )
    end,
    window_start,
    window_end
  from baseline
  cross join measures;
end;
$$;

revoke all on function public.get_leave_processing_target_metrics()
  from public, anon;
grant execute on function public.get_leave_processing_target_metrics()
  to authenticated, service_role;

create or replace function public.populate_exit_clearance_steps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_departments text[];
  configured_value text;
begin
  configured_departments := new.clearance_departments;

  if coalesce(cardinality(configured_departments), 0) = 0 then
    select s.value
    into configured_value
    from public.system_settings s
    where s.key = 'default_clearance_departments';

    if configured_value is not null
      and jsonb_typeof(configured_value::jsonb) = 'array'
    then
      select array_agg(trim(item.value) order by item.ordinality)
      into configured_departments
      from jsonb_array_elements_text(configured_value::jsonb)
        with ordinality as item(value, ordinality)
      where trim(item.value) <> '';
    end if;
  end if;

  if coalesce(cardinality(configured_departments), 0) = 0 then
    configured_departments := array[
      'ICT',
      'Library',
      'Finance',
      'Department head',
      'Knowledge'
    ];
  end if;

  update public.exit_cases
  set clearance_departments = configured_departments
  where id = new.id;

  insert into public.clearance_steps (
    exit_request_id,
    department,
    step_order
  )
  select new.id, department, ordinality::smallint
  from unnest(configured_departments) with ordinality as item(department, ordinality)
  where trim(department) <> ''
  on conflict (exit_request_id, department) do nothing;

  return new;
end;
$$;

revoke all on function public.populate_exit_clearance_steps()
  from public, anon, authenticated;

drop trigger if exists populate_exit_clearance_steps on public.exit_cases;
create trigger populate_exit_clearance_steps
  after insert on public.exit_cases
  for each row execute function public.populate_exit_clearance_steps();

update public.exit_cases
set clearance_departments = array[
  'ICT',
  'Library',
  'Finance',
  'Department head',
  'Knowledge'
]
where coalesce(cardinality(clearance_departments), 0) = 0
  and lower(status) not in ('completed', 'finalized', 'cancelled');

insert into public.clearance_steps (exit_request_id, department, step_order)
select x.id, item.department, item.ordinality::smallint
from public.exit_cases x
cross join lateral unnest(x.clearance_departments)
  with ordinality as item(department, ordinality)
where lower(x.status) not in ('completed', 'finalized', 'cancelled')
  and trim(item.department) <> ''
on conflict (exit_request_id, department) do nothing;

create or replace function public.finalize_exit(
  p_exit_request_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  exit_record public.exit_cases%rowtype;
  employee_record public.employees%rowtype;
  blocker_list jsonb := '[]'::jsonb;
  required_department text;
  missing_requirement record;
  approved_document_exists boolean;
begin
  if auth.uid() is null
    or p_actor_id is distinct from auth.uid()
    or public.hrms_role() not in ('administrator', 'hr')
  then
    raise exception 'You are not authorized to finalize exits.';
  end if;

  select *
  into exit_record
  from public.exit_cases
  where id = p_exit_request_id
  for update;

  if not found then
    raise exception 'Exit request not found.';
  end if;

  if lower(exit_record.status) in ('completed', 'finalized') then
    return jsonb_build_object('success', true, 'blockers', '[]'::jsonb);
  end if;

  select *
  into employee_record
  from public.employees
  where id = exit_record.employee_id
  for update;

  if not found then
    raise exception 'Employee record not found.';
  end if;

  foreach required_department in array coalesce(exit_record.clearance_departments, '{}')
  loop
    if not exists (
      select 1
      from public.clearance_steps cs
      where cs.exit_request_id = exit_record.id
        and lower(trim(cs.department)) = lower(trim(required_department))
        and cs.status = 'approved'
    ) then
      blocker_list := blocker_list || jsonb_build_array(
        jsonb_build_object(
          'message',
          format('Pending clearance: %s.', required_department)
        )
      );
    end if;
  end loop;

  if exists (
    select 1
    from public.assets a
    where a.assigned_to = employee_record.id
      and (
        a.status <> 'verified'
        or a.returned_at is null
        or a.verified_at is null
      )
  ) then
    blocker_list := blocker_list || jsonb_build_array(
      jsonb_build_object('message', 'One or more assigned assets have not been returned and verified.')
    );
  end if;

  for missing_requirement in
    select r.name
    from public.knowledge_requirements r
    where r.active = true
      and r.is_required = true
      and (r.department_id is null or r.department_id = employee_record.department_id)
      and (r.employment_category is null or r.employment_category = employee_record.employment_category)
      and not exists (
        select 1
        from public.knowledge_documents d
        where d.employee_id = employee_record.id
          and d.requirement_id = r.id
          and d.status in ('approved', 'verified')
      )
  loop
    blocker_list := blocker_list || jsonb_build_array(
      jsonb_build_object(
        'message',
        format('Required knowledge handover is missing or unapproved: %s.', missing_requirement.name)
      )
    );
  end loop;

  if employee_record.is_technical then
    select exists (
      select 1
      from public.knowledge_documents d
      where d.employee_id = employee_record.id
        and d.status in ('approved', 'verified')
    )
    into approved_document_exists;

    if not approved_document_exists then
      blocker_list := blocker_list || jsonb_build_array(
        jsonb_build_object('message', 'Technical staff must upload at least one approved knowledge handover document.')
      );
    end if;

    if not exists (
      select 1
      from public.knowledge_requirements r
      where r.active = true
        and r.is_required = true
        and (r.department_id is null or r.department_id = employee_record.department_id)
        and (r.employment_category is null or r.employment_category = employee_record.employment_category)
    ) then
      blocker_list := blocker_list || jsonb_build_array(
        jsonb_build_object('message', 'No mandatory knowledge requirements are configured for this technical employee.')
      );
    end if;
  end if;

  if jsonb_array_length(blocker_list) > 0 then
    return jsonb_build_object('success', false, 'blockers', blocker_list);
  end if;

  update public.exit_cases
  set status = 'completed',
      completed_at = now(),
      completed_by = p_actor_id
  where id = exit_record.id;

  update public.employees
  set employment_status = 'exited',
      exit_date = coalesce(exit_record.last_day, current_date),
      updated_at = now()
  where id = employee_record.id;

  return jsonb_build_object('success', true, 'blockers', '[]'::jsonb);
end;
$$;

revoke all on function public.finalize_exit(uuid, uuid) from public, anon;
grant execute on function public.finalize_exit(uuid, uuid) to authenticated, service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'knowledge-documents',
  'knowledge-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "knowledge documents storage read" on storage.objects;
create policy "knowledge documents storage read"
  on storage.objects for select
  using (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] = 'private'
    and (
      public.hrms_is_hr()
      or exists (
        select 1
        from public.employees e
        where e.id::text = (storage.foldername(name))[2]
          and e.user_id = auth.uid()
      )
    )
  );

drop policy if exists "knowledge documents storage upload" on storage.objects;
create policy "knowledge documents storage upload"
  on storage.objects for insert
  with check (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] = 'private'
    and (
      public.hrms_is_hr()
      or exists (
        select 1
        from public.employees e
        where e.id::text = (storage.foldername(name))[2]
          and e.user_id = auth.uid()
      )
    )
  );

drop policy if exists "knowledge documents storage delete" on storage.objects;
create policy "knowledge documents storage delete"
  on storage.objects for delete
  using (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] = 'private'
    and (
      public.hrms_is_hr()
      or exists (
        select 1
        from public.employees e
        where e.id::text = (storage.foldername(name))[2]
          and e.user_id = auth.uid()
      )
    )
  );
