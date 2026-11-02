alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = 'hr',
    active = false
where role = 'employee';

update public.profiles
set role = 'hr'
where role = 'hr_manager';

update public.profiles
set role = 'hr',
    active = false
where role not in ('administrator', 'hr');

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('administrator', 'hr'));

alter table public.profiles
  alter column role set default 'hr';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'HR account'
    ),
    'hr',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated;

create or replace function public.hrms_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select lower(profile.role)
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.active = true
    ),
    'inactive'
  );
$$;

revoke all on function public.hrms_role() from public, anon;
grant execute on function public.hrms_role() to authenticated;

create or replace function public.hrms_is_hr()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.hrms_role()) in ('administrator', 'hr');
$$;

revoke all on function public.hrms_is_hr() from public, anon;
grant execute on function public.hrms_is_hr() to authenticated;

drop policy if exists "responses scope" on public.survey_responses;
create policy "hr manage engagement survey responses"
  on public.survey_responses for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "employees read own engagement responses"
  on public.survey_responses;
drop policy if exists "employees submit own open engagement response"
  on public.survey_responses;

drop policy if exists "employees read open engagement surveys"
  on public.engagement_surveys;
create policy "hr and administrator read engagement surveys"
  on public.engagement_surveys for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr manage engagement surveys"
  on public.engagement_surveys;
create policy "hr and administrator manage engagement surveys"
  on public.engagement_surveys for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr read engagement survey responses"
  on public.survey_responses;
create policy "hr and administrator read engagement survey responses"
  on public.survey_responses for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'));

revoke all on public.engagement_surveys, public.survey_responses
  from public, anon;
grant select, insert, update, delete on public.engagement_surveys
  to authenticated;
grant select on public.survey_responses to authenticated;

drop policy if exists "hr manage retention actions"
  on public.retention_actions;
drop policy if exists "retention hr only"
  on public.retention_actions;
create policy "hr manage retention actions"
  on public.retention_actions for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr staff manage past exits"
  on public.past_exit_records;
create policy "hr staff manage past exits"
  on public.past_exit_records for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr staff manage exit interviews"
  on public.exit_interviews;
create policy "hr staff manage exit interviews"
  on public.exit_interviews for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr manage employment history"
  on public.employment_history;
create policy "hr and administrator manage employment history"
  on public.employment_history for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr and employee read employee documents"
  on public.employee_documents;
create policy "hr and administrator read employee documents"
  on public.employee_documents for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr upload employee documents"
  on public.employee_documents;
create policy "hr and administrator upload employee documents"
  on public.employee_documents for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select public.hrms_role()) in ('hr', 'administrator')
  );

drop policy if exists "owner and hr read employee document files"
  on storage.objects;
create policy "hr and administrator read employee document files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-hr-documents'
    and exists (
      select 1
      from public.employee_documents document
      where document.storage_path = storage.objects.name
    )
    and (select public.hrms_role()) in ('hr', 'administrator')
  );

drop policy if exists "hr and employee read handover guides"
  on public.handover_guides;
create policy "hr and administrator read handover guides"
  on public.handover_guides for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "employee and hr upload handover guides"
  on public.handover_guides;
create policy "hr and administrator upload handover guides"
  on public.handover_guides for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select public.hrms_role()) in ('hr', 'administrator')
  );

drop policy if exists "successors read their shared handover guides"
  on public.handover_guide_shares;
create policy "hr and administrator read handover guide shares"
  on public.handover_guide_shares for select to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "hr staff manage handover guide shares"
  on public.handover_guide_shares;
create policy "hr and administrator manage handover guide shares"
  on public.handover_guide_shares for all to authenticated
  using ((select public.hrms_role()) in ('hr', 'administrator'))
  with check ((select public.hrms_role()) in ('hr', 'administrator'));

drop policy if exists "employee and hr read handover guide files"
  on storage.objects;
create policy "hr and administrator read handover guide files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'handover-guides'
    and exists (
      select 1
      from public.handover_guides guide
      where guide.storage_path = storage.objects.name
    )
    and (select public.hrms_role()) in ('hr', 'administrator')
  );

drop policy if exists "employee and hr upload handover guide files"
  on storage.objects;
create policy "hr and administrator upload handover guide files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'handover-guides'
    and (select public.hrms_role()) in ('hr', 'administrator')
  );