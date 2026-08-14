-- Development/demo seed data for CUT-Retain.
-- Use only fictional data.

insert into departments (id, name, code, description)
values
  (gen_random_uuid(), 'Information and Communication Technology', 'ICT', 'Technology and access management'),
  (gen_random_uuid(), 'Human Resources', 'HR', 'People operations and exit processing'),
  (gen_random_uuid(), 'Library Services', 'LIB', 'Collections and access obligations'),
  (gen_random_uuid(), 'Faculty of Information Science', 'FIS', 'Academic department'),
  (gen_random_uuid(), 'Faculty of Engineering', 'ENG', 'Academic department'),
  (gen_random_uuid(), 'Finance', 'FIN', 'Finance and procurement controls'),
  (gen_random_uuid(), 'Research and Innovation', 'R&I', 'Research governance'),
  (gen_random_uuid(), 'Procurement', 'PROC', 'Contract and assets management'),
  (gen_random_uuid(), 'Administration', 'ADMIN', 'Institutional administration')
on conflict (name) do nothing;

insert into system_settings (key, value)
values
  ('organization_name', 'CUT Retain Demo Institution'),
  ('default_clearance_departments', '["ICT","Library","Finance","Department head","Knowledge"]'),
  ('notification_channel', 'email'),
  ('retention_days', '2555'),
  ('security_mode', 'standard')
on conflict (key) do update set value = excluded.value, updated_at = now();
