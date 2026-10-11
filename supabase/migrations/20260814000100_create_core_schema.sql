-- Safe extension of the existing CUT-Retain schema.
-- This migration creates missing tables that the app already references,
-- but only if they do not already exist.

create extension if not exists pgcrypto;

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text,
  department_id uuid references departments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  full_name text not null,
  email text,
  phone text,
  department_id uuid references departments(id),
  job_title text,
  employment_category text default 'academic'::text,
  employment_status text not null default 'active'::text,
  joined_on timestamptz,
  exit_date timestamptz,
  manager_id uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exit_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  reason text not null,
  status text not null default 'submitted'::text,
  last_day timestamptz,
  submitted_on timestamptz,
  completed_at timestamptz,
  finalized_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exit_requests_status_chk check (
    status in ('draft','submitted','under_review','clearance','blocked','eligible_for_finalization','completed','rejected','cancelled')
  )
);

create table if not exists clearance_steps (
  id uuid primary key default gen_random_uuid(),
  exit_request_id uuid not null references exit_requests(id) on delete cascade,
  department text not null,
  step_order integer not null default 1,
  status text not null default 'pending'::text,
  comments text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exit_request_id, department),
  constraint clearance_steps_status_chk check (
    status in ('pending','in_progress','approved','rejected','blocked')
  )
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique,
  asset_type text not null,
  description text,
  status text not null default 'available'::text,
  assigned_to uuid references employees(id),
  returned_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_status_chk check (
    status in ('available','assigned','returned','retired','damaged','lost','verified')
  )
);

alter table public.assets
  add column if not exists assigned_to uuid references public.employees(id);

alter table public.assets
  add column if not exists returned_at timestamptz;

alter table public.assets
  add column if not exists verified_at timestamptz;

create table if not exists asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  exit_request_id uuid references exit_requests(id),
  title text not null,
  category text,
  storage_path text,
  status text not null default 'pending'::text,
  created_by uuid references auth.users(id),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_documents_status_chk check (
    status in ('pending','submitted','verified','rejected')
  )
);

alter table public.knowledge_documents
  add column if not exists employee_id uuid references public.employees(id) on delete cascade;

alter table public.knowledge_documents
  add column if not exists exit_request_id uuid references public.exit_requests(id);

alter table public.knowledge_documents
  add column if not exists title text;

alter table public.knowledge_documents
  add column if not exists category text;

alter table public.knowledge_documents
  add column if not exists storage_path text;

alter table public.knowledge_documents
  add column if not exists status text not null default 'pending'::text;

alter table public.knowledge_documents
  add column if not exists created_by uuid references auth.users(id);

alter table public.knowledge_documents
  add column if not exists verified_by uuid references auth.users(id);

alter table public.knowledge_documents
  add column if not exists verified_at timestamptz;

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists system_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'info'::text,
  title text not null,
  message text not null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists employees_department_id_idx on employees(department_id);
create index if not exists employees_status_idx on employees(employment_status);
create index if not exists exit_requests_employee_id_idx on exit_requests(employee_id);
create index if not exists exit_requests_status_idx on exit_requests(status);
create index if not exists clearance_steps_exit_request_id_idx on clearance_steps(exit_request_id);
create index if not exists clearance_steps_status_idx on clearance_steps(status);
create index if not exists assets_assigned_to_idx on assets(assigned_to);
create index if not exists asset_history_asset_id_idx on asset_history(asset_id);
create index if not exists knowledge_documents_employee_id_idx on knowledge_documents(employee_id);
create index if not exists knowledge_documents_exit_request_id_idx on knowledge_documents(exit_request_id);
create index if not exists audit_events_actor_id_idx on audit_events(actor_id);
create index if not exists notifications_user_id_idx on notifications(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN assigned_to uuid REFERENCES public.employees(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'assigned_to'
  ) THEN
    CREATE INDEX IF NOT EXISTS assets_assigned_to_idx ON public.assets(assigned_to);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_documents'
      AND column_name = 'exit_request_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS knowledge_documents_exit_request_id_idx ON public.knowledge_documents(exit_request_id);
  END IF;
END $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger set_departments_updated_at
before update on departments
for each row execute function public.touch_updated_at();

create or replace trigger set_profiles_updated_at
before update on profiles
for each row execute function public.touch_updated_at();

create or replace trigger set_employees_updated_at
before update on employees
for each row execute function public.touch_updated_at();

create or replace trigger set_exit_requests_updated_at
before update on exit_requests
for each row execute function public.touch_updated_at();

create or replace trigger set_clearance_steps_updated_at
before update on clearance_steps
for each row execute function public.touch_updated_at();

create or replace trigger set_assets_updated_at
before update on assets
for each row execute function public.touch_updated_at();

create or replace trigger set_knowledge_documents_updated_at
before update on knowledge_documents
for each row execute function public.touch_updated_at();

create or replace trigger set_system_settings_updated_at
before update on system_settings
for each row execute function public.touch_updated_at();

create or replace function public.set_system_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.system_settings(key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key)
  do update set value = excluded.value, updated_at = now();
end;
$$;

create or replace function public.ensure_exit_clearance_steps(p_exit_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
  declare
    l_departments text[] := array['ICT','Library','Finance','Department head','Knowledge'];
    l_department text;
  begin
    foreach l_department in array l_departments
    loop
      insert into public.clearance_steps (exit_request_id, department, step_order, status)
      values (p_exit_request_id, l_department, array_position(l_departments, l_department), 'pending')
      on conflict (exit_request_id, department)
      do nothing;
    end loop;
  end;
$$;
