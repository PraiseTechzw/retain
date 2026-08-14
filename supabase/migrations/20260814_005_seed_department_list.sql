-- Ensure the department catalog exists and is readable by authenticated users.

alter table public.departments enable row level security;

-- Allow signed-in users to read the department catalog and complete onboarding.
drop policy if exists signed_in_users_access_departments on public.departments;
create policy signed_in_users_access_departments on public.departments
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- The onboarding flow also writes to profiles, so ensure the user can save it.
alter table public.profiles enable row level security;

drop policy if exists employee_self_profile on public.profiles;
create policy employee_self_profile on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

insert into public.departments (name, code, description)
values
  ('Information and Communication Technology', 'ICT', 'Technology and access management'),
  ('Human Resources', 'HR', 'People operations and exit processing'),
  ('Library Services', 'LIB', 'Collections and access obligations'),
  ('Faculty of Information Science', 'FIS', 'Academic department'),
  ('Faculty of Engineering', 'ENG', 'Academic department'),
  ('Finance', 'FIN', 'Finance and procurement controls'),
  ('Research and Innovation', 'R&I', 'Research governance'),
  ('Procurement', 'PROC', 'Contract and assets management')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();
