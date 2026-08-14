-- Demo seed dataset for CUT-Retain.

insert into departments (name, code, description)
values
  ('Information and Communication Technology', 'ICT', 'Technology and access management'),
  ('Human Resources', 'HR', 'People operations and exit processing'),
  ('Library Services', 'LIB', 'Collections and access obligations'),
  ('Faculty of Information Science', 'FIS', 'Academic department'),
  ('Faculty of Engineering', 'ENG', 'Academic department'),
  ('Finance', 'FIN', 'Finance and procurement controls'),
  ('Research and Innovation', 'R&I', 'Research governance'),
  ('Procurement', 'PROC', 'Contract and assets management'),
  ('Administration', 'ADMIN', 'Institutional administration')
on conflict (name) do nothing;

insert into system_settings (key, value)
values
  ('organization_name', 'CUT Retain Demo Institution'),
  ('default_clearance_departments', 'ICT,Library,Finance,Department head,Knowledge'),
  ('notification_channel', 'email'),
  ('retention_days', '2555'),
  ('security_mode', 'standard')
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into role_permissions (role_name, permission_name)
values
  ('Administrator', 'manage_system_settings'),
  ('Administrator', 'finalize_exits'),
  ('Administrator', 'approve_clearance'),
  ('HR', 'manage_employees'),
  ('HR', 'finalize_exits'),
  ('HR', 'approve_clearance'),
  ('ICT', 'approve_ict_clearance'),
  ('Library', 'approve_library_clearance'),
  ('Management', 'view_reports'),
  ('Employee', 'view_own_profile'),
  ('Employee', 'view_own_exit_requests')
on conflict (role_name, permission_name) do nothing;
