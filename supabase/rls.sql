-- RLS setup for the existing CUT-Retain tables.

alter table departments enable row level security;
alter table profiles enable row level security;
alter table employees enable row level security;
alter table exit_requests enable row level security;
alter table clearance_steps enable row level security;
alter table assets enable row level security;
alter table asset_history enable row level security;
alter table knowledge_documents enable row level security;
alter table audit_events enable row level security;
alter table system_settings enable row level security;
alter table notifications enable row level security;

-- helper: user role from auth metadata
create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    'employee'
  );
$$;

-- Signed-in users can access core workflow tables. Privileged actions remain
-- enforced in the server-side app logic, which is the actual authorization layer.
drop policy if exists employee_self_profile on profiles;
drop policy if exists "Profiles are editable by owner" on profiles;
drop policy if exists "Profiles are viewable by owner or admins" on profiles;
create policy employee_self_profile on profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists signed_in_users_access_departments on departments;
create policy signed_in_users_access_departments on departments
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_employees on employees;
create policy signed_in_users_access_employees on employees
for select
using (auth.uid() is not null);

drop policy if exists signed_in_users_access_exit_requests on exit_requests;
create policy signed_in_users_access_exit_requests on exit_requests
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_clearances on clearance_steps;
create policy signed_in_users_access_clearances on clearance_steps
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_assets on assets;
create policy signed_in_users_access_assets on assets
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_asset_history on asset_history;
create policy signed_in_users_access_asset_history on asset_history
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_knowledge on knowledge_documents;
create policy signed_in_users_access_knowledge on knowledge_documents
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_notifications on notifications;
create policy signed_in_users_access_notifications on notifications
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists signed_in_users_access_system_settings on system_settings;
create policy signed_in_users_access_system_settings on system_settings
for select
using (auth.uid() is not null);

drop policy if exists signed_in_users_access_audit_events on audit_events;
create policy signed_in_users_access_audit_events on audit_events
for select
using (auth.uid() is not null);

create policy signed_in_users_insert_audit_events on audit_events
for insert
with check (auth.uid() is not null);
