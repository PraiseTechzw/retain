-- Reconcile employee columns used by the application when an older database
-- was created from a partial or legacy schema instead of the current core SQL.
begin;

alter table public.employees
  add column if not exists phone text,
  add column if not exists job_title text,
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists employment_category text default 'academic'::text,
  add column if not exists employment_status text not null default 'active'::text,
  add column if not exists joined_on timestamptz,
  add column if not exists exit_date timestamptz,
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists home_area text,
  add column if not exists commute_distance_km numeric(7, 2),
  add column if not exists is_technical boolean not null default false;

create unique index if not exists employees_user_id_idx
  on public.employees(user_id)
  where user_id is not null;

commit;
