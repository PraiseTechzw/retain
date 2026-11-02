alter table public.engagement_surveys
  add column if not exists questions jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.engagement_surveys'::regclass
      and conname = 'engagement_surveys_questions_array'
  ) then
    alter table public.engagement_surveys
      add constraint engagement_surveys_questions_array
      check (jsonb_typeof(questions) = 'array') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.engagement_surveys'::regclass
      and conname = 'engagement_surveys_dates_valid'
  ) then
    alter table public.engagement_surveys
      add constraint engagement_surveys_dates_valid
      check (closes_on >= opens_on) not valid;
  end if;
end;
$$;

create table if not exists public.employment_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  job_title text,
  grade text,
  employment_type text not null,
  staff_category text not null check (staff_category in ('academic', 'non_academic')),
  effective_from date not null,
  effective_to date,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists employment_history_employee_start_idx
  on public.employment_history (employee_id, effective_from);
create index if not exists employment_history_employee_range_idx
  on public.employment_history (employee_id, effective_from desc, effective_to);

insert into public.employment_history (
  employee_id,
  department_id,
  job_title,
  grade,
  employment_type,
  staff_category,
  effective_from,
  effective_to
)
select
  e.id,
  e.department_id,
  e.job_title,
  e.grade,
  e.employment_type,
  e.staff_category,
  coalesce(
    e.appointment_date,
    e.joined_on,
    case
      when e.employment_status = 'exited' then coalesce(e.exit_date, e.created_at::date)
    end,
    e.created_at::date
  ),
  case
    when e.employment_status = 'exited' then coalesce(e.exit_date, e.created_at::date)
  end
from public.employees e
where not exists (
  select 1
  from public.employment_history h
  where h.employee_id = e.id
);

update public.employment_history h
set effective_to = coalesce(e.exit_date, current_date)
from public.employees e
where h.employee_id = e.id
  and e.employment_status = 'exited'
  and h.effective_to is null
  and h.effective_from <= coalesce(e.exit_date, current_date);

create or replace function public.record_employment_history_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  effective_day date := current_date;
  open_history public.employment_history%rowtype;
begin
  if new.employment_status = 'exited' then
    select *
    into open_history
    from public.employment_history h
    where h.employee_id = old.id
      and h.effective_to is null
    order by h.effective_from desc
    limit 1
    for update;

    if found then
      update public.employment_history
      set department_id = new.department_id,
          job_title = new.job_title,
          grade = new.grade,
          employment_type = new.employment_type,
          staff_category = new.staff_category,
          effective_to = coalesce(new.exit_date, effective_day),
          changed_by = (select auth.uid())
      where id = open_history.id;
    end if;
    return new;
  end if;

  if row(
    old.department_id,
    old.job_title,
    old.grade,
    old.employment_type,
    old.staff_category
  ) is not distinct from row(
    new.department_id,
    new.job_title,
    new.grade,
    new.employment_type,
    new.staff_category
  ) and old.employment_status <> 'exited' then
    return new;
  end if;

  select *
  into open_history
  from public.employment_history h
  where h.employee_id = old.id
    and h.effective_to is null
  order by h.effective_from desc
  limit 1
  for update;

  if found and open_history.effective_from >= effective_day then
    update public.employment_history
    set department_id = new.department_id,
        job_title = new.job_title,
        grade = new.grade,
        employment_type = new.employment_type,
        staff_category = new.staff_category,
        changed_by = (select auth.uid())
    where id = open_history.id;
    return new;
  end if;

  if found then
    update public.employment_history
    set effective_to = effective_day - 1
    where id = open_history.id;
  elsif coalesce(old.appointment_date, old.joined_on, old.created_at::date) < effective_day then
    insert into public.employment_history (
      employee_id,
      department_id,
      job_title,
      grade,
      employment_type,
      staff_category,
      effective_from,
      changed_by
    )
    values (
      old.id,
      old.department_id,
      old.job_title,
      old.grade,
      old.employment_type,
      old.staff_category,
      coalesce(old.appointment_date, old.joined_on, old.created_at::date),
      effective_day - 1,
      (select auth.uid())
    )
    on conflict (employee_id, effective_from) do nothing;
  end if;

  insert into public.employment_history (
    employee_id,
    department_id,
    job_title,
    grade,
    employment_type,
    staff_category,
    effective_from,
    changed_by
  )
  values (
    new.id,
    new.department_id,
    new.job_title,
    new.grade,
    new.employment_type,
    new.staff_category,
    effective_day,
    (select auth.uid())
  )
  on conflict (employee_id, effective_from) do update
  set department_id = excluded.department_id,
      job_title = excluded.job_title,
      grade = excluded.grade,
      employment_type = excluded.employment_type,
      staff_category = excluded.staff_category,
      effective_to = null,
      changed_by = excluded.changed_by;

  return new;
end;
$$;

create or replace function public.record_new_employee_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.employment_history (
    employee_id,
    department_id,
    job_title,
    grade,
    employment_type,
    staff_category,
    effective_from,
    effective_to,
    changed_by
  )
  values (
    new.id,
    new.department_id,
    new.job_title,
    new.grade,
    new.employment_type,
    new.staff_category,
    coalesce(
      new.appointment_date,
      new.joined_on,
      case
        when new.employment_status = 'exited' then coalesce(new.exit_date, new.created_at::date)
      end,
      new.created_at::date
    ),
    case
      when new.employment_status = 'exited' then coalesce(new.exit_date, new.created_at::date)
    end,
    (select auth.uid())
  )
  on conflict (employee_id, effective_from) do nothing;
  return new;
end;
$$;

drop trigger if exists employees_record_history on public.employees;
create trigger employees_record_history
  after update of department_id, job_title, grade, employment_type, staff_category,
    employment_status, exit_date
  on public.employees
  for each row
  execute function public.record_employment_history_change();
drop trigger if exists employees_create_history on public.employees;
create trigger employees_create_history
  after insert on public.employees
  for each row
  execute function public.record_new_employee_history();
revoke all on function public.record_employment_history_change()
  from public, anon, authenticated;
revoke all on function public.record_new_employee_history()
  from public, anon, authenticated;

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  category text not null check (category in ('appointment', 'contract', 'policy', 'other')),
  title text not null,
  file_name text not null,
  mime_type text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  check (length(btrim(title)) between 1 and 160),
  check (length(btrim(file_name)) between 1 and 180)
);

create index if not exists employee_documents_employee_created_idx
  on public.employee_documents (employee_id, created_at desc);

alter table public.employment_history enable row level security;
alter table public.employee_documents enable row level security;

drop policy if exists "hr read employment history" on public.employment_history;
drop policy if exists "employee read own employment history" on public.employment_history;
drop policy if exists "hr manage employment history" on public.employment_history;
create policy "hr read employment history"
  on public.employment_history for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));
create policy "employee read own employment history"
  on public.employment_history for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = employment_history.employee_id
        and e.user_id = (select auth.uid())
    )
  );
create policy "hr manage employment history"
  on public.employment_history for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

drop policy if exists "hr and employee read employee documents" on public.employee_documents;
drop policy if exists "hr upload employee documents" on public.employee_documents;
create policy "hr and employee read employee documents"
  on public.employee_documents for select to authenticated
  using (
    (select public.hrms_role()) in ('hr', 'hr_manager')
    or exists (
      select 1 from public.employees e
      where e.id = employee_documents.employee_id
        and e.user_id = (select auth.uid())
    )
  );
create policy "hr upload employee documents"
  on public.employee_documents for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select public.hrms_role()) in ('hr', 'hr_manager')
  );

revoke all on table public.employment_history, public.employee_documents
  from public, anon;
grant select, insert, update, delete on public.employment_history to authenticated;
grant select, insert on public.employee_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-hr-documents',
  'employee-hr-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hr read employee document files" on storage.objects;
drop policy if exists "owner and hr read employee document files" on storage.objects;
drop policy if exists "hr upload employee document files" on storage.objects;
drop policy if exists "hr remove orphaned employee document files" on storage.objects;
create policy "owner and hr read employee document files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-hr-documents'
    and exists (
      select 1
      from public.employee_documents d
      where d.storage_path = storage.objects.name
    )
  );
create policy "hr upload employee document files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-hr-documents'
    and (select public.hrms_role()) in ('hr', 'hr_manager')
  );
create policy "hr remove orphaned employee document files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'employee-hr-documents'
    and (select public.hrms_role()) in ('hr', 'hr_manager')
    and not exists (
      select 1
      from public.employee_documents d
      where d.storage_path = storage.objects.name
    )
  );

drop policy if exists "surveys read" on public.engagement_surveys;
drop policy if exists "manage surveys" on public.engagement_surveys;
drop policy if exists "hr manage engagement surveys" on public.engagement_surveys;
drop policy if exists "employees read open engagement surveys" on public.engagement_surveys;
create policy "hr manage engagement surveys"
  on public.engagement_surveys for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));
create policy "employees read open engagement surveys"
  on public.engagement_surveys for select to authenticated
  using (
    status = 'open'
    and jsonb_array_length(questions) > 0
    and opens_on <= current_date
    and closes_on >= current_date
  );

drop policy if exists "responses scope" on public.survey_responses;
drop policy if exists "hr read engagement survey responses" on public.survey_responses;
drop policy if exists "employees read own engagement responses" on public.survey_responses;
drop policy if exists "employees submit own open engagement response" on public.survey_responses;
create policy "hr read engagement survey responses"
  on public.survey_responses for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'));
create policy "employees read own engagement responses"
  on public.survey_responses for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = survey_responses.employee_id
        and e.user_id = (select auth.uid())
    )
  );
create policy "employees submit own open engagement response"
  on public.survey_responses for insert to authenticated
  with check (
    exists (
      select 1
      from public.employees e
      join public.engagement_surveys s on s.id = survey_responses.survey_id
      where e.id = survey_responses.employee_id
        and e.user_id = (select auth.uid())
        and s.status = 'open'
        and s.opens_on <= current_date
        and s.closes_on >= current_date
    )
  );

revoke all on table public.engagement_surveys, public.survey_responses
  from public, anon;
grant select, insert, update on public.engagement_surveys to authenticated;
grant select, insert on public.survey_responses to authenticated;

create or replace function public.validate_engagement_survey_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  survey public.engagement_surveys%rowtype;
  question jsonb;
  question_count integer := 0;
  employee_user_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before submitting an engagement survey.';
  end if;

  select e.user_id
  into employee_user_id
  from public.employees e
  where e.id = new.employee_id
    and e.employment_status <> 'exited';

  if employee_user_id is distinct from (select auth.uid()) then
    raise exception 'You can only submit your own engagement survey response.';
  end if;

  select s.*
  into survey
  from public.engagement_surveys s
  where s.id = new.survey_id
    and s.status = 'open'
    and s.opens_on <= current_date
    and s.closes_on >= current_date;

  if not found or jsonb_typeof(new.answers) <> 'object' then
    raise exception 'This engagement survey is not open or the response is invalid.';
  end if;

  for question in select value from jsonb_array_elements(survey.questions)
  loop
    question_count := question_count + 1;
    if question->>'type' <> 'rating'
      or question->>'key' is null
      or not (new.answers ? (question->>'key'))
      or new.answers->>(question->>'key') not in ('1', '2', '3', '4', '5') then
      raise exception 'The survey response does not match the published questions.';
    end if;
  end loop;

  if question_count = 0
    or (select count(*) from jsonb_object_keys(new.answers)) <> question_count then
    raise exception 'The survey response must answer every published question.';
  end if;

  return new;
end;
$$;

create or replace function public.audit_engagement_survey_response()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'submitted',
    'engagement_survey_response',
    new.survey_id::text,
    jsonb_build_object('survey_id', new.survey_id)
  );
  return new;
end;
$$;

drop trigger if exists validate_engagement_survey_response
  on public.survey_responses;
create trigger validate_engagement_survey_response
  before insert on public.survey_responses
  for each row
  execute function public.validate_engagement_survey_response();
drop trigger if exists audit_engagement_survey_response
  on public.survey_responses;
create trigger audit_engagement_survey_response
  after insert on public.survey_responses
  for each row
  execute function public.audit_engagement_survey_response();
revoke all on function public.validate_engagement_survey_response()
  from public, anon, authenticated;
revoke all on function public.audit_engagement_survey_response()
  from public, anon, authenticated;

create or replace function public.get_engagement_survey_aggregates(
  p_survey_ids uuid[]
)
returns table (
  survey_id uuid,
  question_key text,
  answer_value text,
  response_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select public.hrms_role()) not in ('hr', 'hr_manager') then
    raise exception 'Only HR staff can view engagement survey aggregates.';
  end if;
  if coalesce(cardinality(p_survey_ids), 0) > 100 then
    raise exception 'Request no more than 100 survey aggregates at a time.';
  end if;

  return query
  with qualified_surveys as (
    select r.survey_id
    from public.survey_responses r
    where r.survey_id = any(coalesce(p_survey_ids, array[]::uuid[]))
    group by r.survey_id
    having count(distinct r.employee_id) >= 5
  )
  select
    r.survey_id,
    answer.key,
    answer.value,
    count(*)::bigint
  from public.survey_responses r
  join qualified_surveys q on q.survey_id = r.survey_id
  cross join lateral jsonb_each_text(r.answers) as answer(key, value)
  group by r.survey_id, answer.key, answer.value
  order by r.survey_id, answer.key, answer.value;
end;
$$;

revoke all on function public.validate_engagement_survey_response()
  from public, anon, authenticated;
revoke all on function public.audit_engagement_survey_response()
  from public, anon, authenticated;
revoke all on function public.get_engagement_survey_aggregates(uuid[])
  from public, anon;
grant execute on function public.get_engagement_survey_aggregates(uuid[])
  to authenticated;

drop policy if exists "retention hr only" on public.retention_actions;
drop policy if exists "hr manage retention actions" on public.retention_actions;
create policy "hr manage retention actions"
  on public.retention_actions for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'hr_manager'))
  with check ((select public.hrms_role()) in ('hr', 'hr_manager'));

create or replace function public.submit_engagement_survey(
  p_survey_id uuid,
  p_answers jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  if (select auth.uid()) is null
    or p_survey_id is null
    or p_answers is null
    or jsonb_typeof(p_answers) <> 'object'
    or octet_length(p_answers::text) > 16000 then
    raise exception 'Invalid engagement survey response.';
  end if;

  select e.id
  into v_employee_id
  from public.employees e
  where e.user_id = (select auth.uid())
    and e.employment_status <> 'exited';

  if v_employee_id is null then
    raise exception 'No active employee record is linked to this account.';
  end if;

  insert into public.survey_responses (survey_id, employee_id, answers)
  select s.id, v_employee_id, p_answers
  from public.engagement_surveys s
  where s.id = p_survey_id
    and s.status = 'open'
    and s.opens_on <= current_date
    and s.closes_on >= current_date
  on conflict (survey_id, employee_id) do nothing;

  if not found then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.submit_engagement_survey(uuid, jsonb)
  from public, anon;
grant execute on function public.submit_engagement_survey(uuid, jsonb)
  to authenticated;