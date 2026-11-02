alter table public.departments
  add column if not exists school text;

alter table public.employees
  add column if not exists joined_on date;

alter table public.exit_cases
  add column if not exists good_standing boolean not null default false,
  add column if not exists open_to_return boolean not null default false;

create table if not exists public.past_exit_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  exit_date date not null,
  reason_category text not null,
  reason_text text,
  source text not null default 'historical_import',
  good_standing boolean not null default false,
  open_to_return boolean not null default false,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, exit_date),
  check (length(btrim(reason_category)) between 1 and 100),
  check (reason_text is null or length(reason_text) <= 2000)
);

alter table public.past_exit_records
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists past_exit_records_date_idx
  on public.past_exit_records (exit_date desc);
create index if not exists past_exit_records_employee_idx
  on public.past_exit_records (employee_id);
create index if not exists past_exit_records_rehire_idx
  on public.past_exit_records (open_to_return, good_standing)
  where open_to_return and good_standing;

create table if not exists public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  exit_case_id uuid not null unique references public.exit_cases(id) on delete cascade,
  interviewer_id uuid not null references auth.users(id),
  interview_date date not null default current_date,
  responses jsonb not null default '{}'::jsonb,
  would_return boolean,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(responses) = 'object')
);

create table if not exists public.handover_guides (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  title text not null,
  storage_path text not null unique,
  version integer not null check (version > 0),
  review_due_on date not null default (current_date + interval '12 months')::date,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, version),
  check (length(btrim(title)) between 1 and 160)
);

create index if not exists handover_guides_employee_version_idx
  on public.handover_guides (employee_id, version desc);

create table if not exists public.handover_guide_shares (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.handover_guides(id) on delete cascade,
  successor_employee_id uuid not null references public.employees(id) on delete cascade,
  shared_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (guide_id, successor_employee_id)
);

create index if not exists handover_guide_shares_successor_idx
  on public.handover_guide_shares (successor_employee_id);

create table if not exists public.post_exit_survey_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  wave smallint not null check (wave in (3, 6)),
  questions jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(questions) = 'array')
);

insert into public.post_exit_survey_templates (name, wave, questions)
values
  (
    'Three-month former employee follow-up',
    3,
    '[{"key":"main_reason","prompt":"What was the main reason you left?","options":["compensation","career_growth","workload","management","work_environment","relocation","personal","retirement","contract_end","health","education","other"]},{"key":"could_change","prompt":"What could the University have done differently to retain you?"},{"key":"would_return","prompt":"Would you consider returning to the University?","options":["yes","no","unsure"]}]'::jsonb
  ),
  (
    'Six-month former employee follow-up',
    6,
    '[{"key":"main_reason","prompt":"Has your view of the reasons for leaving changed?","options":["compensation","career_growth","workload","management","work_environment","relocation","personal","retirement","contract_end","health","education","other"]},{"key":"current_reflection","prompt":"What is one important lesson the University should learn from your departure?"},{"key":"would_return","prompt":"Would you consider returning to the University?","options":["yes","no","unsure"]}]'::jsonb
  )
on conflict (name) do nothing;

create table if not exists public.post_exit_survey_invitations (
  id uuid primary key default gen_random_uuid(),
  exit_case_id uuid not null references public.exit_cases(id) on delete cascade,
  template_id uuid not null references public.post_exit_survey_templates(id),
  wave smallint not null check (wave in (3, 6)),
  due_on date not null,
  expires_on date not null,
  token_hash text unique,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'submitted', 'failed', 'expired')),
  sent_at timestamptz,
  submitted_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  unique (exit_case_id, wave),
  check (expires_on >= due_on)
);

create index if not exists post_exit_survey_dispatch_idx
  on public.post_exit_survey_invitations (due_on, status)
  where status in ('scheduled', 'failed');

create table if not exists public.post_exit_survey_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique
    references public.post_exit_survey_invitations(id) on delete cascade,
  answers jsonb not null,
  confirmed_reason text,
  submitted_at timestamptz not null default now(),
  check (jsonb_typeof(answers) = 'object'),
  check (length(coalesce(confirmed_reason, '')) <= 2000)
);

create table if not exists public.retention_followup_flags (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  follow_up_on date,
  outcome text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(reason)) between 1 and 1000),
  check (outcome is null or length(outcome) <= 2000)
);

create index if not exists retention_followup_flags_queue_idx
  on public.retention_followup_flags (status, follow_up_on);

alter table public.past_exit_records enable row level security;
alter table public.exit_interviews enable row level security;
alter table public.handover_guides enable row level security;
alter table public.handover_guide_shares enable row level security;
alter table public.post_exit_survey_templates enable row level security;
alter table public.post_exit_survey_invitations enable row level security;
alter table public.post_exit_survey_responses enable row level security;
alter table public.retention_followup_flags enable row level security;

drop policy if exists "hr staff manage past exits" on public.past_exit_records;
drop policy if exists "hr staff manage exit interviews" on public.exit_interviews;
drop policy if exists "employee and hr read handover guides" on public.handover_guides;
drop policy if exists "employee and hr upload handover guides" on public.handover_guides;
drop policy if exists "hr staff manage handover guide shares" on public.handover_guide_shares;
drop policy if exists "successors read their shared handover guides" on public.handover_guide_shares;
drop policy if exists "hr staff read survey templates" on public.post_exit_survey_templates;
drop policy if exists "hr staff manage survey templates" on public.post_exit_survey_templates;
drop policy if exists "hr staff read survey invitations" on public.post_exit_survey_invitations;
drop policy if exists "hr staff manage survey invitations" on public.post_exit_survey_invitations;
drop policy if exists "hr staff read survey responses" on public.post_exit_survey_responses;
drop policy if exists "hr staff manage follow-up flags" on public.retention_followup_flags;
drop policy if exists "employee and hr read handover guide files" on storage.objects;
drop policy if exists "employee and hr upload handover guide files" on storage.objects;

create policy "hr staff manage past exits"
  on public.past_exit_records for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "hr staff manage exit interviews"
  on public.exit_interviews for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "employee and hr read handover guides"
  on public.handover_guides for select to authenticated
  using (
    (select public.hrms_is_hr())
    or exists (
      select 1
      from public.employees e
      where e.id = employee_id and e.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.handover_guide_shares s
      join public.employees successor on successor.id = s.successor_employee_id
      where s.guide_id = handover_guides.id
        and successor.user_id = (select auth.uid())
    )
  );

create policy "employee and hr upload handover guides"
  on public.handover_guides for insert to authenticated
  with check (
    (select public.hrms_is_hr())
    or (
      uploaded_by = (select auth.uid())
      and exists (
        select 1
        from public.employees e
        where e.id = employee_id and e.user_id = (select auth.uid())
      )
    )
  );

create policy "hr staff manage handover guide shares"
  on public.handover_guide_shares for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "successors read their shared handover guides"
  on public.handover_guide_shares for select to authenticated
  using (
    exists (
      select 1
      from public.employees successor
      where successor.id = successor_employee_id
        and successor.user_id = (select auth.uid())
    )
  );

create policy "hr staff read survey templates"
  on public.post_exit_survey_templates for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "hr staff manage survey templates"
  on public.post_exit_survey_templates for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "hr staff read survey invitations"
  on public.post_exit_survey_invitations for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "hr staff manage survey invitations"
  on public.post_exit_survey_invitations for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "hr staff read survey responses"
  on public.post_exit_survey_responses for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));

create policy "hr staff manage follow-up flags"
  on public.retention_followup_flags for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

revoke all on table
  public.past_exit_records,
  public.exit_interviews,
  public.handover_guides,
  public.handover_guide_shares,
  public.post_exit_survey_templates,
  public.post_exit_survey_invitations,
  public.post_exit_survey_responses,
  public.retention_followup_flags
from public, anon;
grant select, insert, update, delete on public.past_exit_records to authenticated;
grant select, insert, update, delete on public.exit_interviews to authenticated;
revoke update, delete on public.handover_guides from authenticated;
grant select, insert on public.handover_guides to authenticated;
grant select, insert, update, delete on public.handover_guide_shares to authenticated;
revoke insert, update, delete on public.post_exit_survey_templates from authenticated;
grant select on public.post_exit_survey_templates to authenticated;
grant select, insert, update, delete on public.post_exit_survey_invitations to authenticated;
revoke insert, update, delete on public.post_exit_survey_responses from authenticated;
grant select on public.post_exit_survey_responses to authenticated;
grant select, insert, update, delete on public.retention_followup_flags to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'handover-guides',
  'handover-guides',
  false,
  10485760,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "employee and hr read handover guide files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'handover-guides'
    and (
      (select public.hrms_is_hr())
      or (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.handover_guides g
        join public.handover_guide_shares s on s.guide_id = g.id
        join public.employees successor on successor.id = s.successor_employee_id
        where g.storage_path = name
          and successor.user_id = (select auth.uid())
      )
    )
  );

create policy "employee and hr upload handover guide files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'handover-guides'
    and (
      public.hrms_is_hr()
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create or replace function public.schedule_post_exit_surveys()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  exit_day date;
  survey record;
begin
  if lower(new.status) not in ('completed', 'finalized') then
    return new;
  end if;
  if tg_op = 'UPDATE' and lower(old.status) in ('completed', 'finalized') then
    return new;
  end if;

  exit_day := coalesce(new.last_day, new.completed_at::date, current_date);

  for survey in
    select id, wave
    from public.post_exit_survey_templates
    where active
    order by wave
  loop
    insert into public.post_exit_survey_invitations (
      exit_case_id,
      template_id,
      wave,
      due_on,
      expires_on
    )
    values (
      new.id,
      survey.id,
      survey.wave,
      (exit_day + make_interval(months => survey.wave))::date,
      (exit_day + make_interval(months => survey.wave) + interval '30 days')::date
    )
    on conflict (exit_case_id, wave) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists schedule_post_exit_surveys_on_completion
  on public.exit_cases;
create trigger schedule_post_exit_surveys_on_completion
  after insert or update of status on public.exit_cases
  for each row execute function public.schedule_post_exit_surveys();
revoke all on function public.schedule_post_exit_surveys()
  from public, anon, authenticated;

create or replace function public.submit_post_exit_survey(
  p_token_hash text,
  p_answers jsonb,
  p_confirmed_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
begin
  if p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_answers) <> 'object'
    or octet_length(p_answers::text) > 12000
    or length(coalesce(p_confirmed_reason, '')) > 2000 then
    raise exception 'Invalid survey response.';
  end if;

  select i.id
  into invitation_id
  from public.post_exit_survey_invitations i
  where i.token_hash = p_token_hash
    and i.status = 'sent'
    and i.expires_on >= current_date
  for update;

  if invitation_id is null then
    return false;
  end if;

  insert into public.post_exit_survey_responses (
    invitation_id,
    answers,
    confirmed_reason
  )
  values (
    invitation_id,
    p_answers,
    nullif(btrim(p_confirmed_reason), '')
  );

  update public.post_exit_survey_invitations
  set status = 'submitted',
      submitted_at = now(),
      token_hash = null
  where id = invitation_id;

  return true;
end;
$$;

revoke all on function public.submit_post_exit_survey(text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_post_exit_survey(text, jsonb, text)
  to service_role;

create or replace function public.import_past_exits(p_records jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  row_number integer := 0;
  v_employee_id uuid;
  v_department_id uuid;
  v_joined_date date;
  v_leaving_date date;
  inserted_count integer := 0;
begin
  if p_records is null
    or (select public.hrms_role()) not in ('hr', 'hr_manager')
    or jsonb_typeof(p_records) <> 'array'
    or jsonb_array_length(p_records) < 1
    or jsonb_array_length(p_records) > 500 then
    raise exception 'Historical import requires an HR account and 1 to 500 valid rows.';
  end if;

  for item in select value from jsonb_array_elements(p_records)
  loop
    row_number := row_number + 1;
    if length(btrim(coalesce(item->>'employee_number', ''))) not between 1 and 40
      or length(btrim(coalesce(item->>'full_name', ''))) not between 1 and 160
      or coalesce(item->>'staff_category', '') not in ('academic', 'non_academic')
      or length(btrim(coalesce(item->>'reason_category', ''))) not between 1 and 100 then
      raise exception 'Historical import row % has missing or invalid required fields.', row_number;
    end if;

    v_joined_date := nullif(item->>'joined_on', '')::date;
    v_leaving_date := nullif(item->>'exit_date', '')::date;
    if v_leaving_date is null or (v_joined_date is not null and v_joined_date > v_leaving_date) then
      raise exception 'Historical import row % has invalid employment dates.', row_number;
    end if;
    if coalesce((item->>'open_to_return')::boolean, false)
      and not coalesce((item->>'good_standing')::boolean, false) then
      raise exception 'Historical import row % cannot be marked open to return unless good standing is true.', row_number;
    end if;

    v_department_id := null;
    if nullif(btrim(item->>'department'), '') is not null then
      select d.id into v_department_id
      from public.departments d
      where lower(d.name) = lower(btrim(item->>'department'))
      limit 1;
      if v_department_id is null then
        raise exception 'Historical import row % has an unknown department.', row_number;
      end if;
    end if;

    select e.id into v_employee_id
    from public.employees e
    where e.employee_number = btrim(item->>'employee_number');

    if v_employee_id is null then
      insert into public.employees (
        employee_number,
        full_name,
        email,
        department_id,
        job_title,
        staff_category,
        employment_type,
        employment_status,
        appointment_date,
        joined_on,
        exit_date
      )
      values (
        btrim(item->>'employee_number'),
        btrim(item->>'full_name'),
        nullif(btrim(item->>'email'), ''),
        v_department_id,
        nullif(btrim(item->>'job_title'), ''),
        item->>'staff_category',
        coalesce(nullif(btrim(item->>'employment_type'), ''), 'permanent'),
        'exited',
        v_joined_date,
        v_joined_date,
        v_leaving_date
      )
      returning id into v_employee_id;
    end if;

    insert into public.past_exit_records (
      employee_id,
      department_id,
      exit_date,
      reason_category,
      reason_text,
      source,
      good_standing,
      open_to_return,
      recorded_by
    )
    values (
      v_employee_id,
      coalesce(v_department_id, (select e.department_id from public.employees e where e.id = v_employee_id)),
      v_leaving_date,
      btrim(item->>'reason_category'),
      nullif(btrim(item->>'reason_text'), ''),
      'historical_import',
      coalesce((item->>'good_standing')::boolean, false),
      coalesce((item->>'open_to_return')::boolean, false),
      (select auth.uid())
    )
    on conflict (employee_id, exit_date) do nothing;

    if found then
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'imported',
    'past_exit_records',
    null,
    jsonb_build_object('inserted', inserted_count)
  );

  return inserted_count;
end;
$$;

revoke all on function public.import_past_exits(jsonb) from public, anon;
grant execute on function public.import_past_exits(jsonb) to authenticated;

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
      past.reason_category as reason
    from public.past_exit_records past
    join public.employees e on e.id = past.employee_id
    left join public.departments d on d.id = coalesce(past.department_id, e.department_id)
    union all
    select
      coalesce(ec.last_day, ec.completed_at::date, e.exit_date, ec.created_at::date),
      coalesce(d.name, 'Unassigned'),
      coalesce(
        sr.reason,
        nullif(btrim(ec.reason_category), ''),
        nullif(btrim(ec.reason), ''),
        'Not recorded'
      )
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
    group by q.quarter_start, x.department, x.reason
  ),
  totals as (
    select q.quarter_start, x.department, count(*) as exits
    from quarters q
    join exits x on x.exit_date between q.quarter_start and q.quarter_end
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
        where coalesce(e.appointment_date, e.joined_on, e.created_at::date) <= q.quarter_end
          and coalesce(e.exit_date, current_date + 1) > q.quarter_end
      ) as end_headcount
    from quarters q
    join public.employees e
      on coalesce(e.appointment_date, e.joined_on, e.created_at::date) <= q.quarter_end
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
  where (select public.hrms_role()) in ('administrator', 'hr', 'hr_manager')
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
      past.reason_category
    from public.past_exit_records past
    join public.employees e on e.id = past.employee_id
    left join public.departments d on d.id = coalesce(past.department_id, e.department_id)
    union all
    select
      coalesce(d.school, 'Not recorded'),
      coalesce(d.name, 'Unassigned'),
      coalesce(
        sr.reason,
        nullif(btrim(ec.reason_category), ''),
        nullif(btrim(ec.reason), ''),
        'Not recorded'
      )
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
  order by count(*) desc, h.school, h.department;
$$;

revoke all on function public.get_turnover_baseline() from public, anon;
grant execute on function public.get_turnover_baseline() to authenticated;