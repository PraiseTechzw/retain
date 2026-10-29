create table if not exists public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_requirements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_required boolean not null default true,
  active boolean not null default true,
  reviewer_role text not null default 'HR',
  department_id uuid references public.departments(id) on delete set null,
  employment_category text,
  category_id uuid references public.knowledge_categories(id) on delete set null,
  allowed_file_types text[] not null default array['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  max_file_size_mb integer not null default 10 check (max_file_size_mb > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  requirement_id uuid references public.knowledge_requirements(id) on delete set null,
  category_id uuid references public.knowledge_categories(id) on delete set null,
  title text not null,
  category text,
  description text,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  version integer not null default 1 check (version > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'pending_review', 'revision_required', 'rejected', 'approved', 'verified')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_categories enable row level security;
alter table public.knowledge_requirements enable row level security;
alter table public.knowledge_documents enable row level security;

drop policy if exists "knowledge categories read" on public.knowledge_categories;
create policy "knowledge categories read"
  on public.knowledge_categories for select
  using (auth.uid() is not null);
drop policy if exists "knowledge categories manage" on public.knowledge_categories;
create policy "knowledge categories manage"
  on public.knowledge_categories for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

drop policy if exists "knowledge requirements read" on public.knowledge_requirements;
create policy "knowledge requirements read"
  on public.knowledge_requirements for select
  using (auth.uid() is not null);
drop policy if exists "knowledge requirements manage" on public.knowledge_requirements;
create policy "knowledge requirements manage"
  on public.knowledge_requirements for all
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

drop policy if exists "knowledge documents scope" on public.knowledge_documents;
create policy "knowledge documents scope"
  on public.knowledge_documents for select
  using (
    public.hrms_is_hr()
    or exists (
      select 1
      from public.employees e
      where e.id = employee_id
        and e.user_id = auth.uid()
    )
  );
drop policy if exists "knowledge documents upload" on public.knowledge_documents;
create policy "knowledge documents upload"
  on public.knowledge_documents for insert
  with check (
    public.hrms_is_hr()
    or exists (
      select 1
      from public.employees e
      where e.id = employee_id
        and e.user_id = auth.uid()
    )
  );
drop policy if exists "knowledge documents review" on public.knowledge_documents;
create policy "knowledge documents review"
  on public.knowledge_documents for update
  using (public.hrms_is_hr())
  with check (public.hrms_is_hr());

grant select, insert, update, delete on public.knowledge_categories to authenticated;
grant select, insert, update, delete on public.knowledge_requirements to authenticated;
grant select, insert, update, delete on public.knowledge_documents to authenticated;
grant all privileges on public.knowledge_categories to service_role;
grant all privileges on public.knowledge_requirements to service_role;
grant all privileges on public.knowledge_documents to service_role;
