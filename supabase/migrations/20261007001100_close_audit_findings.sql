create or replace function public.current_app_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
  );
$$;

revoke execute on function public.current_app_active() from public, anon;
grant execute on function public.current_app_active() to authenticated;

create or replace view public.asset_employee_directory
with (security_invoker = false, security_barrier = true)
as
select id, full_name, employee_number, department_id
from public.employees
where public.current_app_active()
  and (
    public.current_app_role() in (
      'administrator', 'hr', 'management', 'ict', 'library'
    )
    or user_id = auth.uid()
  );

revoke all on public.asset_employee_directory from public, anon, authenticated;
grant select on public.asset_employee_directory to authenticated;

create or replace function public.can_review_knowledge_document(
  p_employee_id uuid,
  p_requirement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_active()
    and not exists (
      select 1
      from public.employees employee
      where employee.id = p_employee_id
        and (
          employee.user_id = auth.uid()
          or lower(coalesce(employee.email, '')) =
             lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    and (
      exists (
        select 1
        from public.profiles reviewer
        where reviewer.id = auth.uid()
          and lower(coalesce(reviewer.role, '')) in ('administrator', 'hr', 'management')
      )
      or exists (
        select 1
        from public.knowledge_requirements requirement
        join public.profiles reviewer on reviewer.id = auth.uid()
        where requirement.id = p_requirement_id
          and lower(btrim(coalesce(reviewer.role, ''))) =
              lower(btrim(coalesce(requirement.reviewer_role, '')))
      )
    );
$$;

revoke execute on function public.can_review_knowledge_document(uuid, uuid)
  from public, anon;
grant execute on function public.can_review_knowledge_document(uuid, uuid)
  to authenticated;

create or replace view public.knowledge_review_employee_directory
with (security_invoker = false, security_barrier = true)
as
select employee.id, employee.full_name, employee.employee_number
from public.employees employee
where public.current_app_active()
  and (
    employee.user_id = auth.uid()
    or exists (
      select 1
      from public.knowledge_documents document
      where document.employee_id = employee.id
        and public.can_review_knowledge_document(
          document.employee_id,
          document.requirement_id
        )
    )
  );

revoke all on public.knowledge_review_employee_directory
  from public, anon, authenticated;
grant select on public.knowledge_review_employee_directory to authenticated;

create or replace function public.guard_employee_self_service()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_role text := public.current_app_role();
  v_profile_department_id uuid;
begin
  if auth.uid() is null or v_role in ('administrator', 'hr') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid()
      or lower(coalesce(new.email, '')) <> v_email
    then
      raise exception 'Users may only create their own employee record';
    end if;
    new.employee_number := 'USER-' || upper(left(auth.uid()::text, 8));
    select profile.full_name, profile.department_id
    into new.full_name, new.department_id
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.active = true;
    if new.full_name is null then
      new.full_name := coalesce(auth.jwt() ->> 'full_name', split_part(v_email, '@', 1));
    end if;
    new.employment_category := case
      when v_role = 'support staff' then 'support'
      when v_role = 'academic attaché' then 'academic_attaché'
      else 'academic'
    end;
    new.job_title := 'Onboarded user';
    new.employment_status := 'active';
    new.phone := null;
    new.joined_on := current_date;
    new.exit_date := null;
    new.manager_id := null;
    new.home_area := null;
    new.commute_distance_km := null;
    new.is_technical := false;
    return new;
  end if;

  if new.id is distinct from old.id
    or (old.user_id is not null and old.user_id <> auth.uid())
    or (old.user_id is null and lower(coalesce(old.email, '')) <> v_email)
    or new.user_id is distinct from auth.uid()
  then
    raise exception 'Users may only link their own employee record';
  end if;

  new.employee_number := old.employee_number;
  new.full_name := old.full_name;
  new.email := old.email;
  new.phone := old.phone;
  new.job_title := old.job_title;
  select profile.department_id
  into v_profile_department_id
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.active = true;
  new.department_id := coalesce(old.department_id, v_profile_department_id);
  new.employment_category := old.employment_category;
  new.employment_status := old.employment_status;
  new.joined_on := old.joined_on;
  new.exit_date := old.exit_date;
  new.manager_id := old.manager_id;
  new.home_area := old.home_area;
  new.commute_distance_km := old.commute_distance_km;
  new.is_technical := old.is_technical;
  new.created_at := old.created_at;
  new.updated_at := old.updated_at;
  return new;
end;
$$;

drop policy if exists employees_read_scope on public.employees;
create policy employees_read_scope on public.employees
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management')
      or user_id = auth.uid()
      or (
        user_id is null
        and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );

drop policy if exists employees_insert_scope on public.employees;
create policy employees_insert_scope on public.employees
  for insert with check (
    public.current_app_role() in ('administrator', 'hr')
    or (
      public.current_app_active()
      and user_id = auth.uid()
      and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists employees_update_scope on public.employees;
create policy employees_update_scope on public.employees
  for update
  using (
    public.current_app_role() in ('administrator', 'hr')
    or (
      public.current_app_active()
      and (
        user_id = auth.uid()
        or (
          user_id is null
          and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
    )
  )
  with check (
    public.current_app_role() in ('administrator', 'hr')
    or (
      public.current_app_active()
      and user_id = auth.uid()
      and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists exit_requests_read_scope on public.exit_requests;
create policy exit_requests_read_scope on public.exit_requests
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management')
      or exists (
        select 1 from public.employees employee
        where employee.id = exit_requests.employee_id
          and employee.user_id = auth.uid()
      )
    )
  );

drop policy if exists exit_requests_insert_self on public.exit_requests;
create policy exit_requests_insert_self on public.exit_requests
  for insert with check (
    public.current_app_active()
    and status in ('draft', 'submitted')
    and exists (
      select 1 from public.employees employee
      where employee.id = exit_requests.employee_id
        and employee.user_id = auth.uid()
    )
  );

drop policy if exists clearance_steps_read_scope on public.clearance_steps;
create policy clearance_steps_read_scope on public.clearance_steps
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management')
      or public.can_approve_clearance(department)
      or exists (
        select 1
        from public.exit_requests exit_request
        join public.employees employee on employee.id = exit_request.employee_id
        where exit_request.id = clearance_steps.exit_request_id
          and employee.user_id = auth.uid()
      )
    )
  );

drop policy if exists assets_read_scope on public.assets;
create policy assets_read_scope on public.assets
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
      or exists (
        select 1 from public.employees employee
        where employee.id = assets.assigned_to
          and employee.user_id = auth.uid()
      )
    )
  );

drop policy if exists knowledge_documents_read_scope on public.knowledge_documents;
create policy knowledge_documents_read_scope on public.knowledge_documents
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management')
      or public.can_review_knowledge_document(employee_id, requirement_id)
      or exists (
        select 1 from public.employees employee
        where employee.id = knowledge_documents.employee_id
          and employee.user_id = auth.uid()
      )
    )
  );

drop policy if exists knowledge_documents_insert_scope on public.knowledge_documents;
create policy knowledge_documents_insert_scope on public.knowledge_documents
  for insert with check (
    public.current_app_active()
    and (
      (
        public.current_app_role() in ('administrator', 'hr')
        and status in ('pending', 'submitted', 'pending_review', 'revision_required', 'approved', 'verified', 'rejected')
      )
      or (
        created_by = auth.uid()
        and status in ('pending', 'submitted')
        and verified_by is null
        and verified_at is null
        and exists (
          select 1 from public.employees employee
          where employee.id = knowledge_documents.employee_id
            and employee.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists knowledge_documents_update_hr on public.knowledge_documents;
create policy knowledge_documents_update_reviewers on public.knowledge_documents
  for update
  using (public.can_review_knowledge_document(employee_id, requirement_id))
  with check (public.can_review_knowledge_document(employee_id, requirement_id));

create or replace function public.guard_knowledge_document_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.can_review_knowledge_document(old.employee_id, old.requirement_id)
    or new.id is distinct from old.id
    or new.employee_id is distinct from old.employee_id
    or new.requirement_id is distinct from old.requirement_id
    or new.title is distinct from old.title
    or new.category is distinct from old.category
    or new.category_id is distinct from old.category_id
    or new.exit_request_id is distinct from old.exit_request_id
    or new.description is distinct from old.description
    or new.storage_path is distinct from old.storage_path
    or new.file_name is distinct from old.file_name
    or new.mime_type is distinct from old.mime_type
    or new.file_size is distinct from old.file_size
    or new.version is distinct from old.version
    or new.previous_version_id is distinct from old.previous_version_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at
    or new.status not in ('approved', 'rejected', 'revision_required')
  then
    raise exception 'Only an authorized reviewer may update document review status';
  end if;

  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_knowledge_document_review on public.knowledge_documents;
create trigger guard_knowledge_document_review
before update on public.knowledge_documents
for each row execute function public.guard_knowledge_document_review();

create or replace function public.enforce_leave_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer;
  v_last_year integer;
  v_year_start date;
  v_year_end date;
  v_request_start date;
  v_request_end date;
  v_balance record;
  v_used_days integer;
  v_request_days integer;
  v_requested_days integer := 0;
  v_cursor date;
begin
  if tg_op <> 'INSERT' or new.status <> 'pending' then
    return new;
  end if;

  if new.ends_on < new.starts_on then
    raise exception 'Leave end date must not be before its start date';
  end if;

  v_year := extract(year from new.starts_on)::integer;
  v_last_year := extract(year from new.ends_on)::integer;

  while v_year <= v_last_year loop
    v_year_start := make_date(v_year, 1, 1);
    v_year_end := make_date(v_year, 12, 31);
    v_request_start := greatest(new.starts_on, v_year_start);
    v_request_end := least(new.ends_on, v_year_end);
    v_request_days := 0;

    v_cursor := v_request_start;
    while v_cursor <= v_request_end loop
      if extract(isodow from v_cursor) < 6 then
        v_request_days := v_request_days + 1;
      end if;
      v_cursor := v_cursor + 1;
    end loop;
    v_requested_days := v_requested_days + v_request_days;

    select entitled_days, carried_over_days
    into v_balance
    from public.leave_balances
    where employee_id = new.employee_id
      and leave_year = v_year
      and lower(leave_type) = lower(new.leave_type)
    for update;

    if not found then
      raise exception 'No leave balance is configured for % in %', new.leave_type, v_year;
    end if;

    select coalesce(sum((
      select count(*)
      from generate_series(
        greatest(request.starts_on, v_year_start)::timestamp,
        least(request.ends_on, v_year_end)::timestamp,
        interval '1 day'
      ) as calendar(day)
      where extract(isodow from calendar.day) < 6
    )), 0)
    into v_used_days
    from public.leave_requests request
    where request.employee_id = new.employee_id
      and lower(request.leave_type) = lower(new.leave_type)
      and request.status in ('pending', 'approved')
      and request.starts_on <= v_year_end
      and request.ends_on >= v_year_start;

    if v_used_days + v_request_days >
      v_balance.entitled_days + v_balance.carried_over_days
    then
      raise exception 'Leave request exceeds the available % balance for %', new.leave_type, v_year;
    end if;

    v_year := v_year + 1;
  end loop;

  if v_requested_days = 0 then
    raise exception 'Leave must include at least one weekday';
  end if;
  new.requested_days := v_requested_days;
  return new;
end;
$$;

revoke execute on function public.enforce_leave_balance() from public, anon, authenticated;
drop trigger if exists enforce_leave_balance on public.leave_requests;
create trigger enforce_leave_balance
before insert on public.leave_requests
for each row execute function public.enforce_leave_balance();

drop policy if exists leave_requests_read_scope on public.leave_requests;
create policy leave_requests_read_scope on public.leave_requests
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management')
      or exists (
        select 1 from public.employees employee
        where employee.id = leave_requests.employee_id
          and employee.user_id = auth.uid()
      )
    )
  );

drop policy if exists leave_requests_insert_self on public.leave_requests;
create policy leave_requests_insert_self on public.leave_requests
  for insert with check (
    public.current_app_active()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.employees employee
      where employee.id = leave_requests.employee_id
        and employee.user_id = auth.uid()
    )
  );

drop policy if exists leave_balances_read_scope on public.leave_balances;
create policy leave_balances_read_scope on public.leave_balances
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr')
      or exists (
        select 1 from public.employees employee
        where employee.id = leave_balances.employee_id
          and employee.user_id = auth.uid()
      )
    )
  );

drop policy if exists asset_daily_logs_read_roles on public.asset_daily_logs;
create policy asset_daily_logs_read_roles on public.asset_daily_logs
  for select using (
    public.current_app_active()
    and public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
  );

drop policy if exists recruitment_openings_read_roles on public.recruitment_openings;
create policy recruitment_openings_read_roles on public.recruitment_openings
  for select using (
    public.current_app_active()
    and public.current_app_role() in ('administrator', 'hr', 'management')
  );

drop policy if exists retention_interventions_read_roles on public.retention_interventions;
create policy retention_interventions_read_roles on public.retention_interventions
  for select using (
    public.current_app_active()
    and public.current_app_role() in ('administrator', 'hr', 'management')
  );

drop policy if exists quarterly_turnover_reports_read_roles on public.quarterly_turnover_reports;
create policy quarterly_turnover_reports_read_roles on public.quarterly_turnover_reports
  for select using (
    public.current_app_active()
    and public.current_app_role() in ('administrator', 'hr', 'management')
  );

drop policy if exists knowledge_requirements_read_authenticated on public.knowledge_requirements;
create policy knowledge_requirements_read_authenticated on public.knowledge_requirements
  for select using (public.current_app_active());

alter table public.knowledge_categories enable row level security;
alter table public.knowledge_document_versions enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('knowledge_categories', 'knowledge_document_versions')
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

create policy knowledge_categories_read_active on public.knowledge_categories
  for select using (public.current_app_active());
create policy knowledge_categories_manage_hr on public.knowledge_categories
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

create policy knowledge_document_versions_read_scope on public.knowledge_document_versions
  for select using (
    public.current_app_active()
    and exists (
      select 1
      from public.knowledge_documents document
      where document.id = knowledge_document_versions.document_id
        and (
          public.can_review_knowledge_document(
            document.employee_id,
            document.requirement_id
          )
          or exists (
            select 1 from public.employees employee
            where employee.id = document.employee_id
              and employee.user_id = auth.uid()
          )
        )
    )
  );
create policy knowledge_document_versions_insert_owner on public.knowledge_document_versions
  for insert with check (
    public.current_app_active()
    and uploaded_by = auth.uid()
    and status = 'submitted'
    and exists (
      select 1
      from public.knowledge_documents document
      join public.employees employee on employee.id = document.employee_id
      where document.id = knowledge_document_versions.document_id
        and employee.user_id = auth.uid()
    )
  );

drop policy if exists departments_read_authenticated on public.departments;
create policy departments_read_authenticated on public.departments
  for select using (public.current_app_active());

drop policy if exists system_settings_read_authenticated on public.system_settings;
create policy system_settings_read_authenticated on public.system_settings
  for select using (public.current_app_active());

drop policy if exists profiles_update_scope on public.profiles;
create policy profiles_update_scope on public.profiles
  for update
  using (
    public.current_app_role() in ('administrator', 'hr')
    or (id = auth.uid() and public.current_app_active())
  )
  with check (
    public.current_app_role() in ('administrator', 'hr')
    or (id = auth.uid() and public.current_app_active())
  );

drop policy if exists audit_events_read_scope on public.audit_events;
create policy audit_events_read_scope on public.audit_events
  for select using (
    public.current_app_active()
    and (
      actor_id = auth.uid()
      or public.current_app_role() in ('administrator', 'hr', 'management')
    )
  );
drop policy if exists audit_events_insert_self on public.audit_events;
create policy audit_events_insert_self on public.audit_events
  for insert with check (public.current_app_active() and actor_id = auth.uid());

drop policy if exists notifications_read_scope on public.notifications;
create policy notifications_read_scope on public.notifications
  for select using (public.current_app_active() and user_id = auth.uid());
drop policy if exists notifications_insert_self on public.notifications;
create policy notifications_insert_self on public.notifications
  for insert with check (public.current_app_active() and user_id = auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update
  using (public.current_app_active() and user_id = auth.uid())
  with check (public.current_app_active() and user_id = auth.uid());