begin;

-- Remove permissive policies left behind by earlier migrations. PostgreSQL
-- ORs permissive policies, so adding a narrower policy does not replace these.
drop policy if exists signed_in_users_access_employees on public.employees;
drop policy if exists signed_in_users_access_departments on public.departments;
drop policy if exists authenticated_users_read_quarterly_reports on public.quarterly_turnover_reports;
drop policy if exists employee_self_profile on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;

-- Profiles are created only by this trusted Auth trigger. A missing profile can
-- no longer be recreated by the account itself with active=true.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Employee'
    ),
    'Employee',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Serialize requests for one employee, then reject any overlapping pending or
-- approved date range. This covers concurrent requests and direct REST inserts.
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

  perform pg_advisory_xact_lock(hashtextextended(new.employee_id::text, 0));
  if exists (
    select 1
    from public.leave_requests request
    where request.employee_id = new.employee_id
      and request.status in ('pending', 'approved')
      and request.starts_on <= new.ends_on
      and request.ends_on >= new.starts_on
  ) then
    raise exception 'Leave request overlaps an existing pending or approved request';
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

-- Stop direct HR/admin updates from rewriting request ownership, dates, or
-- entitlement inputs. Employees may cancel their own pending requests only.
create or replace function public.guard_leave_request_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
begin
  if not public.current_app_active() then
    raise exception 'An active profile is required';
  end if;

  if v_role in ('administrator', 'hr') then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Only pending requests may be approved or rejected';
    end if;
    if new.employee_id is distinct from old.employee_id
      or new.leave_type is distinct from old.leave_type
      or new.starts_on is distinct from old.starts_on
      or new.ends_on is distinct from old.ends_on
      or new.requested_days is distinct from old.requested_days
      or new.reason is distinct from old.reason
      or new.created_at is distinct from old.created_at
      or new.id is distinct from old.id
    then
      raise exception 'Reviewers cannot edit leave request details';
    end if;
    if new.reviewed_by is distinct from auth.uid() or new.reviewed_at is null then
      raise exception 'A review must record the authenticated reviewer and timestamp';
    end if;
    if exists (
      select 1
      from public.employees employee
      left join auth.users auth_user on auth_user.id = auth.uid()
      where employee.id = new.employee_id
        and (
          employee.user_id = auth.uid()
          or (auth_user.email is not null and lower(coalesce(employee.email, '')) = lower(auth_user.email))
        )
    ) then
      raise exception 'You cannot review your own leave request';
    end if;
    return new;
  end if;

  if old.status <> 'pending' or new.status <> 'cancelled' then
    raise exception 'Employees may cancel pending requests only';
  end if;
  if not exists (
    select 1 from public.employees employee
    where employee.id = old.employee_id and employee.user_id = auth.uid()
  ) then
    raise exception 'Employees may cancel their own leave requests only';
  end if;
  if new.employee_id is distinct from old.employee_id
    or new.leave_type is distinct from old.leave_type
    or new.starts_on is distinct from old.starts_on
    or new.ends_on is distinct from old.ends_on
    or new.requested_days is distinct from old.requested_days
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
    or new.id is distinct from old.id
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.review_notes is distinct from old.review_notes
  then
    raise exception 'Employees may only change a pending request to cancelled';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_leave_request_update() from public, anon, authenticated;
drop trigger if exists guard_leave_request_update on public.leave_requests;
create trigger guard_leave_request_update
before update on public.leave_requests
for each row execute function public.guard_leave_request_update();

drop policy if exists leave_requests_review_hr on public.leave_requests;
create policy leave_requests_review_hr on public.leave_requests
  for update
  using (
    public.current_app_active()
    and public.current_app_role() in ('administrator', 'hr')
  )
  with check (
    public.current_app_active()
    and public.current_app_role() in ('administrator', 'hr')
  );

drop policy if exists leave_requests_cancel_self on public.leave_requests;
create policy leave_requests_cancel_self on public.leave_requests
  for update
  using (
    public.current_app_active()
    and status = 'pending'
    and exists (
      select 1 from public.employees employee
      where employee.id = leave_requests.employee_id
        and employee.user_id = auth.uid()
    )
  )
  with check (
    public.current_app_active()
    and status = 'cancelled'
    and exists (
      select 1 from public.employees employee
      where employee.id = leave_requests.employee_id
        and employee.user_id = auth.uid()
    )
  );

-- Fail migration rather than silently accept pre-existing duplicate checks.
do $$
begin
  if exists (
    select 1
    from public.asset_daily_logs
    where event_type = 'daily_check'
    group by asset_id, logged_on
    having count(*) > 1
  ) then
    raise exception 'Resolve duplicate asset daily checks before applying the unique daily-check index';
  end if;
end;
$$;

create unique index if not exists asset_daily_logs_one_check_per_asset_day
  on public.asset_daily_logs (asset_id, logged_on)
  where event_type = 'daily_check';

-- These SECURITY DEFINER functions are internal implementation details. Their
-- owning functions/triggers retain owner privileges after public RPC access is
-- removed; no application caller invokes them directly.
revoke all on function public.set_system_setting(text, text) from public, anon, authenticated;
revoke all on function public.ensure_exit_clearance_steps(uuid) from public, anon, authenticated;
revoke all on function public.create_notification(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.can_finalize_exit(uuid) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;

commit;
