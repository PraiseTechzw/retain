alter table public.profiles
  add column if not exists confidential_case_officer boolean not null default false;

create or replace function public.hrms_is_confidential_case_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and role in ('hr', 'hr_manager')
      and confidential_case_officer = true
  )
$$;

revoke all on function public.hrms_is_confidential_case_officer()
  from public, anon;
grant execute on function public.hrms_is_confidential_case_officer()
  to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists "hr cases only" on public.hr_cases;
create policy "confidential case officer access"
  on public.hr_cases
  for all
  using (public.hrms_is_confidential_case_officer())
  with check (public.hrms_is_confidential_case_officer());

drop policy if exists "responses scope" on public.survey_responses;
create policy "responses scope"
  on public.survey_responses
  for all
  using (
    public.hrms_is_confidential_case_officer()
    or exists (
      select 1
      from public.employees as employee
      where employee.id = employee_id
        and employee.user_id = auth.uid()
    )
  )
  with check (
    public.hrms_is_confidential_case_officer()
    or exists (
      select 1
      from public.employees as employee
      where employee.id = employee_id
        and employee.user_id = auth.uid()
    )
  );
