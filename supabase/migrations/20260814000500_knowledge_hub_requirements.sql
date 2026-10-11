-- Knowledge Hub requirements, categories, and review workflow.

create table if not exists knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_requirements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id uuid references public.knowledge_categories(id),
  department_id uuid references public.departments(id),
  employment_category text,
  is_required boolean not null default true,
  allowed_file_types text[] not null default ARRAY['pdf','doc','docx','xls','xlsx','csv','ppt','pptx','jpg','jpeg','png','webp','md','json','xml','sql','drawio','vsdx','zip'],
  max_file_size_mb integer not null default 25,
  reviewer_role text not null default 'HR',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  version integer not null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  status text not null default 'submitted',
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

alter table public.knowledge_documents
  add column if not exists requirement_id uuid references public.knowledge_requirements(id),
  add column if not exists category_id uuid references public.knowledge_categories(id),
  add column if not exists description text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists rejection_reason text,
  add column if not exists version integer not null default 1,
  add column if not exists previous_version_id uuid references public.knowledge_documents(id),
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.knowledge_documents
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

create or replace trigger set_knowledge_categories_updated_at
before update on knowledge_categories
for each row execute function public.touch_updated_at();

create or replace trigger set_knowledge_requirements_updated_at
before update on knowledge_requirements
for each row execute function public.touch_updated_at();

create or replace function public.knowledge_completion_for_employee(p_employee_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    (
      select count(*)
      from public.knowledge_documents kd
      join public.knowledge_requirements kr on kr.id = kd.requirement_id
      where kd.employee_id = p_employee_id
        and kr.is_required = true
        and kd.status = 'approved'
    ),
    0
  );
$$;

create or replace function public.knowledge_requirements_count_for_employee(p_employee_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    (
      select count(*)
      from public.knowledge_requirements kr
      left join public.departments d on d.id = kr.department_id
      left join public.employees e on e.id = p_employee_id
      where kr.active = true
        and kr.is_required = true
        and (
          kr.department_id is null
          or kr.department_id = e.department_id
          or e.department_id is null
        )
    ),
    0
  );
$$;

insert into knowledge_categories (name, description, icon, active)
values
  ('Technical Handover', 'Technical architecture, systems, infrastructure, and operational knowledge.', 'cpu', true),
  ('Project Handover', 'Current and in-flight project documentation and operational knowledge.', 'folder', true),
  ('Role Handover', 'Daily duties, responsibilities, and critical working knowledge.', 'briefcase', true),
  ('Department Procedures', 'Departmental operational steps and continuity processes.', 'clipboard', true),
  ('System Documentation', 'Application, infrastructure, and operational system guidance.', 'server', true),
  ('Research / Academic Handover', 'Teaching, academic, and research continuity documentation.', 'book', true),
  ('Institutional Knowledge', 'Institution-wide knowledge that remains valuable beyond a single exit.', 'building', true),
  ('Outstanding Tasks', 'Open work, handover tasks, and unresolved obligations.', 'list', true)
on conflict (name) do nothing;

insert into knowledge_requirements (
  name,
  description,
  category_id,
  department_id,
  employment_category,
  is_required,
  allowed_file_types,
  max_file_size_mb,
  reviewer_role,
  active,
  created_by
)
select
  requirement_name,
  requirement_description,
  kc.id,
  d.id,
  requirement_category,
  true,
  ARRAY['pdf','doc','docx','xls','xlsx','csv','ppt','pptx','jpg','jpeg','png','webp','md','json','xml','sql','drawio','vsdx','zip'],
  25,
  'HR',
  true,
  null
from (
  values
    ('Role Handover', 'Provide the documentation needed to continue your role responsibilities and key operating knowledge.', 'Role Handover', null, null),
    ('Current Projects', 'Document the status, ownership, and active work items for projects in progress.', 'Project Handover', null, null),
    ('Department Procedures', 'Summarize the department procedures and operational continuity expected for successors.', 'Department Procedures', null, null),
    ('Outstanding Tasks', 'List current obligations, pending work, and transition items requiring follow-up.', 'Outstanding Tasks', null, null),
    ('System Documentation', 'Provide the system documentation required to support day-to-day operations after departure.', 'System Documentation', null, null),
    ('Technical Handover', 'Share technical documentation, logs, runbooks, and configuration knowledge for critical systems.', 'Technical Handover', null, 'technical'),
    ('Research / Academic Handover', 'Provide teaching, academic assets, and research continuity information required by the institution.', 'Research / Academic Handover', null, 'academic')
) as reqs(requirement_name, requirement_description, category_name, requirement_category, department_name)
left join public.knowledge_categories kc on kc.name = reqs.category_name
left join public.departments d on d.name = reqs.department_name
on conflict do nothing;

create or replace function public.set_knowledge_document_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

create trigger knowledge_documents_status_audit
before update on public.knowledge_documents
for each row
execute function public.set_knowledge_document_status();
