alter table public.departments
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.system_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

drop policy if exists "administrator system settings" on public.system_settings;
create policy "administrator system settings"
  on public.system_settings
  for all
  using (public.hrms_role() = 'administrator')
  with check (public.hrms_role() = 'administrator');

grant select, insert, update, delete on public.system_settings to authenticated;
grant all privileges on public.system_settings to service_role;
