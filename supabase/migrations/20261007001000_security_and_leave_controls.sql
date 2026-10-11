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

create or replace view public.asset_employee_directory
with (security_invoker = false, security_barrier = true)
as
select id, full_name, employee_number, department_id
from public.employees
where public.current_app_role() in (
    'administrator', 'hr', 'management', 'ict', 'library'
  )
  or user_id = auth.uid();

revoke all on public.asset_employee_directory from public, anon, authenticated;
grant select on public.asset_employee_directory to authenticated;

create or replace function public.guard_profile_authority_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_app_role() = 'administrator' then
    return new;
  end if;

  if public.current_app_role() = 'hr' then
    if tg_op = 'UPDATE'
      and lower(coalesce(new.role, '')) in ('administrator', 'hr')
      and lower(coalesce(new.role, '')) <> lower(coalesce(old.role, ''))
    then
      raise exception 'Only administrators may assign HR or administrator roles';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id <> auth.uid() then
      raise exception 'Users may only create their own profile';
    end if;
    new.role := 'Employee';
    new.active := true;
  else
    if new.id <> old.id or old.id <> auth.uid() then
      raise exception 'Users may only update their own profile';
    end if;
    new.role := old.role;
    new.active := old.active;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_authority_fields on public.profiles;
create trigger guard_profile_authority_fields
before insert or update on public.profiles
for each row execute function public.guard_profile_authority_fields();

create or replace function public.guard_employee_self_service()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_role text := public.current_app_role();
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
    new.employment_category := case
      when v_role = 'support staff' then 'support'
      when v_role = 'academic attaché' then 'academic_attaché'
      else 'academic'
    end;
    new.job_title := 'Onboarded user';
    new.employment_status := 'active';
    new.exit_date := null;
    new.is_technical := false;
    return new;
  end if;

  if new.id <> old.id
    or (old.user_id is not null and old.user_id <> auth.uid())
    or (old.user_id is null and lower(coalesce(old.email, '')) <> v_email)
    or new.user_id is distinct from auth.uid()
  then
    raise exception 'Users may only link their own employee record';
  end if;

  new.employee_number := old.employee_number;
  new.email := old.email;
  new.phone := old.phone;
  new.job_title := old.job_title;
  new.employment_category := old.employment_category;
  new.employment_status := old.employment_status;
  new.joined_on := old.joined_on;
  new.exit_date := old.exit_date;
  new.manager_id := old.manager_id;
  new.home_area := old.home_area;
  new.commute_distance_km := old.commute_distance_km;
  new.is_technical := old.is_technical;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists guard_employee_self_service on public.employees;
create trigger guard_employee_self_service
before insert or update on public.employees
for each row execute function public.guard_employee_self_service();

create or replace function public.guard_clearance_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_app_role() in ('administrator', 'hr') then
    return new;
  end if;

  if not public.can_approve_clearance(old.department)
    or new.id is distinct from old.id
    or new.exit_request_id is distinct from old.exit_request_id
    or new.department is distinct from old.department
    or new.step_order is distinct from old.step_order
    or new.created_at is distinct from old.created_at
    or new.status <> 'approved'
  then
    raise exception 'Clearance officers may only approve their assigned department step';
  end if;

  new.comments := old.comments;
  new.rejected_by := old.rejected_by;
  new.rejected_at := old.rejected_at;
  new.approved_by := auth.uid();
  new.approved_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_clearance_approval on public.clearance_steps;
create trigger guard_clearance_approval
before update on public.clearance_steps
for each row execute function public.guard_clearance_approval();

create or replace function public.can_approve_clearance(p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('administrator', 'hr')
    or (
      public.current_app_role() = 'management'
      and lower(coalesce(p_department, '')) like '%department head%'
    )
    or (
      public.current_app_role() = 'ict'
      and (
        lower(coalesce(p_department, '')) like '%ict%'
        or lower(coalesce(p_department, '')) like '%information and communication technology%'
      )
    )
    or (
      public.current_app_role() = 'library'
      and lower(coalesce(p_department, '')) like '%librar%'
    );
$$;

revoke execute on function public.can_approve_clearance(text) from public, anon;
grant execute on function public.can_approve_clearance(text) to authenticated;

do $$
declare
  policy_row record;
  table_name text;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'departments', 'employees', 'exit_requests', 'clearance_steps',
        'assets', 'asset_history', 'knowledge_documents', 'knowledge_requirements',
        'audit_events', 'system_settings', 'notifications', 'leave_requests',
        'leave_balances', 'asset_daily_logs', 'recruitment_openings',
        'retention_interventions', 'quarterly_turnover_reports'
      ])
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;

  foreach table_name in array array[
    'profiles', 'departments', 'employees', 'exit_requests', 'clearance_steps',
    'assets', 'asset_history', 'knowledge_documents', 'knowledge_requirements',
    'audit_events', 'system_settings', 'notifications', 'leave_requests',
    'leave_balances', 'asset_daily_logs', 'recruitment_openings',
    'retention_interventions', 'quarterly_turnover_reports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy profiles_read_scope on public.profiles
  for select using (
    id = auth.uid()
    or public.current_app_role() in ('administrator', 'hr')
  );
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_scope on public.profiles
  for update
  using (id = auth.uid() or public.current_app_role() in ('administrator', 'hr'))
  with check (id = auth.uid() or public.current_app_role() in ('administrator', 'hr'));
create policy profiles_delete_admin on public.profiles
  for delete using (public.current_app_role() = 'administrator');

create policy departments_read_authenticated on public.departments
  for select using (auth.uid() is not null);
create policy departments_manage_hr on public.departments
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

create policy employees_read_scope on public.employees
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
    or user_id = auth.uid()
    or (
      user_id is null
      and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
create policy employees_insert_scope on public.employees
  for insert with check (
    public.current_app_role() in ('administrator', 'hr')
    or (
      user_id = auth.uid()
      and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
create policy employees_update_scope on public.employees
  for update
  using (
    public.current_app_role() in ('administrator', 'hr')
    or user_id = auth.uid()
    or (
      user_id is null
      and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    public.current_app_role() in ('administrator', 'hr')
    or (
      user_id = auth.uid()
      and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
create policy employees_delete_hr on public.employees
  for delete using (public.current_app_role() in ('administrator', 'hr'));

create policy exit_requests_read_scope on public.exit_requests
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
    or exists (
      select 1 from public.employees e
      where e.id = exit_requests.employee_id and e.user_id = auth.uid()
    )
  );
create policy exit_requests_insert_self on public.exit_requests
  for insert with check (
    status in ('draft', 'submitted')
    and exists (
      select 1 from public.employees e
      where e.id = exit_requests.employee_id and e.user_id = auth.uid()
    )
  );
create policy exit_requests_update_hr on public.exit_requests
  for update
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));
create policy exit_requests_delete_hr on public.exit_requests
  for delete using (public.current_app_role() in ('administrator', 'hr'));

create policy clearance_steps_read_scope on public.clearance_steps
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
    or public.can_approve_clearance(department)
    or exists (
      select 1
      from public.exit_requests er
      join public.employees e on e.id = er.employee_id
      where er.id = clearance_steps.exit_request_id and e.user_id = auth.uid()
    )
  );
create policy clearance_steps_insert_hr on public.clearance_steps
  for insert with check (public.current_app_role() in ('administrator', 'hr'));
create policy clearance_steps_update_scope on public.clearance_steps
  for update
  using (public.can_approve_clearance(department))
  with check (public.can_approve_clearance(department));
create policy clearance_steps_delete_hr on public.clearance_steps
  for delete using (public.current_app_role() in ('administrator', 'hr'));

create policy assets_read_scope on public.assets
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
    or exists (
      select 1 from public.employees e
      where e.id = assets.assigned_to and e.user_id = auth.uid()
    )
  );
create policy assets_manage_scope on public.assets
  for all
  using (public.current_app_role() in ('administrator', 'hr', 'ict', 'library'))
  with check (public.current_app_role() in ('administrator', 'hr', 'ict', 'library'));

create policy asset_history_read_scope on public.asset_history
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
  );
create policy asset_history_insert_scope on public.asset_history
  for insert with check (
    actor_id = auth.uid()
    and public.current_app_role() in ('administrator', 'hr', 'ict', 'library')
  );

create policy knowledge_documents_read_scope on public.knowledge_documents
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
    or exists (
      select 1 from public.employees e
      where e.id = knowledge_documents.employee_id and e.user_id = auth.uid()
    )
  );
create policy knowledge_documents_insert_scope on public.knowledge_documents
  for insert with check (
    (
      public.current_app_role() in ('administrator', 'hr')
      and (status in ('pending', 'submitted', 'pending_review', 'revision_required', 'approved', 'verified', 'rejected'))
    )
    or (
      created_by = auth.uid()
      and status in ('pending', 'submitted')
      and verified_by is null
      and verified_at is null
      and exists (
        select 1 from public.employees e
        where e.id = knowledge_documents.employee_id and e.user_id = auth.uid()
      )
    )
  );
create policy knowledge_documents_update_hr on public.knowledge_documents
  for update
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));
create policy knowledge_documents_delete_hr on public.knowledge_documents
  for delete using (public.current_app_role() in ('administrator', 'hr'));

create policy knowledge_requirements_read_authenticated on public.knowledge_requirements
  for select using (auth.uid() is not null);
create policy knowledge_requirements_manage_hr on public.knowledge_requirements
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

create policy audit_events_read_scope on public.audit_events
  for select using (
    actor_id = auth.uid()
    or public.current_app_role() in ('administrator', 'hr', 'management')
  );
create policy audit_events_insert_self on public.audit_events
  for insert with check (actor_id = auth.uid());

create policy system_settings_read_authenticated on public.system_settings
  for select using (auth.uid() is not null);
create policy system_settings_manage_hr on public.system_settings
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

create policy notifications_read_scope on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_insert_self on public.notifications
  for insert with check (user_id = auth.uid());
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy leave_requests_read_scope on public.leave_requests
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
    or exists (
      select 1 from public.employees e
      where e.id = leave_requests.employee_id and e.user_id = auth.uid()
    )
  );
create policy leave_requests_insert_self on public.leave_requests
  for insert with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.employees e
      where e.id = leave_requests.employee_id and e.user_id = auth.uid()
    )
  );
create policy leave_requests_review_hr on public.leave_requests
  for update
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

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

create policy asset_daily_logs_read_roles on public.asset_daily_logs
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
  );
create policy asset_daily_logs_insert_roles on public.asset_daily_logs
  for insert with check (
    created_by = auth.uid()
    and public.current_app_role() in ('administrator', 'hr', 'management', 'ict', 'library')
  );

create policy recruitment_openings_read_roles on public.recruitment_openings
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
  );
create policy recruitment_openings_manage_roles on public.recruitment_openings
  for all
  using (public.current_app_role() in ('administrator', 'hr', 'management'))
  with check (public.current_app_role() in ('administrator', 'hr', 'management'));

create policy retention_interventions_read_roles on public.retention_interventions
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
  );
create policy retention_interventions_manage_hr on public.retention_interventions
  for all
  using (public.current_app_role() in ('administrator', 'hr'))
  with check (public.current_app_role() in ('administrator', 'hr'));

create policy quarterly_turnover_reports_read_roles on public.quarterly_turnover_reports
  for select using (
    public.current_app_role() in ('administrator', 'hr', 'management')
  );

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
  v_balance record;
  v_used_days numeric;
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
    v_year_start := greatest(new.starts_on, make_date(v_year, 1, 1));
    v_year_end := least(new.ends_on, make_date(v_year, 12, 31));
    v_cursor := v_year_start;
    while v_cursor <= v_year_end loop
      if extract(isodow from v_cursor) < 6 then
        v_requested_days := v_requested_days + 1;
      end if;
      v_cursor := v_cursor + 1;
    end loop;

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

    select coalesce(sum(greatest(
      0,
      (
        select count(*)
        from generate_series(
          greatest(request.starts_on, v_year_start)::timestamp,
          least(request.ends_on, v_year_end)::timestamp,
          interval '1 day'
        ) as calendar(day)
        where extract(isodow from calendar.day) < 6
      )
    )), 0)
    into v_used_days
    from public.leave_requests request
    where request.employee_id = new.employee_id
      and lower(request.leave_type) = lower(new.leave_type)
      and request.status in ('pending', 'approved')
      and request.starts_on <= v_year_end
      and request.ends_on >= v_year_start;

    if v_used_days + (
      select count(*)
      from generate_series(v_year_start::timestamp, v_year_end::timestamp, interval '1 day') as calendar(day)
      where extract(isodow from calendar.day) < 6
    ) > v_balance.entitled_days + v_balance.carried_over_days then
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

revoke all on function public.can_finalize_exit(uuid) from public, anon, authenticated;
revoke all on function public.finalize_exit(uuid, uuid) from public, anon;
grant execute on function public.finalize_exit(uuid, uuid) to authenticated;