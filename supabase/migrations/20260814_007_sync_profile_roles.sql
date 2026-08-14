-- The Auth metadata role is the assigned role used by the server-side
-- authorization checks. Synchronize its public profile copy so a user has one
-- consistent role throughout the application.
update public.profiles as profile
set role = nullif(trim(auth_user.raw_user_meta_data ->> 'role'), ''),
    updated_at = now()
from auth.users as auth_user
where auth_user.id = profile.id
  and nullif(trim(auth_user.raw_user_meta_data ->> 'role'), '') is not null
  and profile.role is distinct from nullif(trim(auth_user.raw_user_meta_data ->> 'role'), '');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() ->> 'role'), 'employee') = 'Administrator';
$$;

-- Remove legacy employee policies that depend on auth.users lookups; these are
-- rejected by Supabase RLS because auth.users is a system table and not a normal
-- user-accessible relation in this app context.
drop policy if exists signed_in_users_access_employees on public.employees;
drop policy if exists deny_all_other_access on public.employees;
drop policy if exists managers_read_all on public.employees;
drop policy if exists employee_self_records on public.employees;

create policy signed_in_users_access_employees on public.employees
for all
using (public.is_admin() or auth.uid() is not null)
with check (public.is_admin() or auth.uid() is not null);
