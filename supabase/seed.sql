-- Development/demo seed data for CUT-ELAMS. Fictional records only.
-- Never run this against production. Employee emails use the reserved .invalid TLD.

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
on conflict (name) do nothing;

-- Seed only unset institution settings; do not overwrite local developer choices.
insert into public.system_settings (key, value)
values
  ('organization_name', 'CUT Retain Demo Institution'),
  ('default_clearance_departments', '["ICT","Library","Finance","Department head","Knowledge"]'),
  ('notification_channel', 'email'),
  ('retention_days', '2555'),
  ('security_mode', 'standard')
on conflict (key) do nothing;

insert into public.role_permissions (role_name, permission_name)
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

-- Synthetic staff directory. These rows have no auth.users/profile login.
insert into public.employees (
  employee_number, full_name, email, department_id, job_title,
  employment_category, employment_status, joined_on, exit_date, is_technical
)
select
  sample.employee_number,
  sample.full_name,
  sample.email,
  department.id,
  sample.job_title,
  sample.employment_category,
  sample.employment_status,
  sample.joined_on,
  sample.exit_date,
  sample.is_technical
from (values
  ('DEMO-1001', 'Alex Example', 'alex.example@example.invalid', 'Faculty of Engineering', 'Lecturer', 'academic', 'active', current_date - interval '6 years', null::timestamptz, false),
  ('DEMO-1002', 'Bailey Sample', 'bailey.sample@example.invalid', 'Information and Communication Technology', 'Systems Analyst', 'support', 'active', current_date - interval '4 years', null::timestamptz, true),
  ('DEMO-1003', 'Casey Test', 'casey.test@example.invalid', 'Library Services', 'Library Officer', 'support', 'active', current_date - interval '3 years', null::timestamptz, false),
  ('DEMO-1004', 'Drew Fiction', 'drew.fiction@example.invalid', 'Faculty of Information Science', 'Lecturer', 'academic', 'active', current_date - interval '5 years', null::timestamptz, false),
  ('DEMO-1005', 'Emery Demo', 'emery.demo@example.invalid', 'Finance', 'Accounts Officer', 'support', 'active', current_date - interval '2 years', null::timestamptz, false),
  ('DEMO-1006', 'Finley Placeholder', 'finley.placeholder@example.invalid', 'Research and Innovation', 'Research Associate', 'academic', 'active', current_date - interval '18 months', null::timestamptz, false),
  ('DEMO-1007', 'Gray Fictional', 'gray.fictional@example.invalid', 'Information and Communication Technology', 'Database Administrator', 'support', 'exited', current_date - interval '7 years', current_date - interval '40 days', true),
  ('DEMO-1008', 'Harper Sample', 'harper.sample@example.invalid', 'Library Services', 'Collections Assistant', 'support', 'exited', current_date - interval '5 years', current_date - interval '130 days', false),
  ('DEMO-1009', 'Indigo Example', 'indigo.example@example.invalid', 'Faculty of Engineering', 'Technician', 'support', 'exited', current_date - interval '3 years', current_date - interval '220 days', true),
  ('DEMO-1010', 'Jordan Test', 'jordan.test@example.invalid', 'Human Resources', 'HR Officer', 'support', 'active', current_date - interval '4 years', null::timestamptz, false),
  ('DEMO-1011', 'Kai Fiction', 'kai.fiction@example.invalid', 'Procurement', 'Procurement Officer', 'support', 'active', current_date - interval '2 years', null::timestamptz, false),
  ('DEMO-1012', 'Lane Placeholder', 'lane.placeholder@example.invalid', 'Faculty of Information Science', 'Technical Officer', 'support', 'active', current_date - interval '14 months', null::timestamptz, true)
) as sample(employee_number, full_name, email, department_name, job_title, employment_category, employment_status, joined_on, exit_date, is_technical)
join public.departments department on department.name = sample.department_name
on conflict (employee_number) do nothing;

-- Mix of assigned, available, damaged, and return-verified equipment.
insert into public.assets (
  asset_tag, asset_type, description, status, assigned_to,
  current_location, returned_at, verified_at
)
select
  sample.asset_tag,
  sample.asset_type,
  sample.description,
  sample.status,
  employee.id,
  sample.current_location,
  sample.returned_at,
  sample.verified_at
from (values
  ('DEMO-ICT-LT-001', 'Laptop', 'Demo laptop assigned to an active technical employee.', 'assigned', 'DEMO-1002', 'ICT · Main office', null::timestamptz, null::timestamptz),
  ('DEMO-ICT-MN-002', 'Monitor', 'Demo monitor assigned to a faculty employee.', 'assigned', 'DEMO-1004', 'Engineering · Room 2', null::timestamptz, null::timestamptz),
  ('DEMO-LIB-LT-003', 'Laptop', 'Demo laptop return-verified after exit.', 'verified', 'DEMO-1008', 'Library · ICT storeroom', now() - interval '120 days', now() - interval '119 days'),
  ('DEMO-ICT-LT-004', 'Laptop', 'Demo assigned laptop with an unresolved damage report.', 'damaged', 'DEMO-1001', 'Engineering · Workshop', null::timestamptz, null::timestamptz),
  ('DEMO-FIN-PR-005', 'Projector', 'Available shared projector for meeting rooms.', 'available', null::text, 'Finance · Equipment room', null::timestamptz, null::timestamptz),
  ('DEMO-LIB-SC-006', 'Scanner', 'Available document scanner.', 'available', null::text, 'Library · Service desk', null::timestamptz, null::timestamptz),
  ('DEMO-ICT-SW-007', 'Network switch', 'Demo network switch assigned to ICT.', 'assigned', 'DEMO-1012', 'ICT · Network room', null::timestamptz, null::timestamptz),
  ('DEMO-ENG-TB-008', 'Tablet', 'Demo tablet return-verified after exit.', 'verified', 'DEMO-1009', 'Engineering · ICT storeroom', now() - interval '210 days', now() - interval '209 days')
) as sample(asset_tag, asset_type, description, status, employee_number, current_location, returned_at, verified_at)
left join public.employees employee on employee.employee_number = sample.employee_number
on conflict (asset_tag) do nothing;

insert into public.asset_tracking_events (
  id, asset_id, source, location, recorded_at, external_event_id
)
select sample.id::uuid, asset.id, sample.source, sample.location,
       sample.recorded_at, sample.external_event_id
from (values
  ('ae000000-0000-4000-8000-000000000011', 'DEMO-FIN-PR-005', 'barcode', 'Finance · Equipment room', now() - interval '2 days', 'demo-barcode-001'),
  ('ae000000-0000-4000-8000-000000000012', 'DEMO-LIB-SC-006', 'rfid', 'Library · Service desk', now() - interval '1 day', 'demo-rfid-001')
) as sample(id, asset_tag, source, location, recorded_at, external_event_id)
join public.assets asset on asset.asset_tag = sample.asset_tag
on conflict do nothing;

-- A blocked technical exit demonstrates clearance, asset, and handover gates.
insert into public.exit_requests (
  id, employee_id, reason, status, last_day, submitted_on, created_at
)
select
  'de000000-0000-4000-8000-000000000001'::uuid,
  employee.id,
  'Demo: planned role transition',
  'clearance',
  current_date + 14,
  now() - interval '3 days',
  now() - interval '3 days'
from public.employees employee
where employee.employee_number = 'DEMO-1002'
on conflict (id) do nothing;

-- Completed exits in multiple quarters feed turnover reports and reason summaries.
insert into public.exit_requests (
  id, employee_id, reason, status, last_day, submitted_on, completed_at, created_at
)
select sample.id::uuid, employee.id, sample.reason, 'completed', sample.exit_at,
       sample.exit_at - interval '30 days', sample.exit_at, sample.exit_at - interval '30 days'
from (values
  ('de000000-0000-4000-8000-000000000007', 'DEMO-1007', 'Career progression', current_date - interval '40 days'),
  ('de000000-0000-4000-8000-000000000008', 'DEMO-1008', 'Relocation', current_date - interval '130 days'),
  ('de000000-0000-4000-8000-000000000009', 'DEMO-1009', 'Further study', current_date - interval '220 days')
) as sample(id, employee_number, reason, exit_at)
join public.employees employee on employee.employee_number = sample.employee_number
on conflict (id) do nothing;

-- The seed runs as the local database owner. Mark historical steps complete so
-- seeded completed exits do not inflate the open-clearance dashboard.
update public.clearance_steps step
set status = 'approved',
    comments = 'Demo approval for fictional history.',
    approved_at = now() - interval '200 days',
    updated_at = now() - interval '200 days'
from public.exit_requests request
join public.employees employee on employee.id = request.employee_id
where step.exit_request_id = request.id
  and request.status = 'completed'
  and employee.employee_number in ('DEMO-1007', 'DEMO-1008', 'DEMO-1009')
  and step.status <> 'approved';

-- Daily checks populate coverage and create corresponding tracking events.
insert into public.asset_daily_logs (asset_id, employee_id, event_type, logged_on, location, notes)
select asset.id, asset.assigned_to, 'daily_check', current_date,
       asset.current_location, 'Demo daily check; fictional data.'
from public.assets asset
where asset.asset_tag in ('DEMO-ICT-LT-001', 'DEMO-ICT-SW-007')
on conflict do nothing;

insert into public.asset_history (
  id, asset_id, action, previous_status, new_status, notes, created_at
)
select sample.id::uuid, asset.id, sample.action, sample.previous_status,
       sample.new_status, sample.notes, sample.created_at
from (values
  ('ae000000-0000-4000-8000-000000000001', 'DEMO-ICT-LT-001', 'assigned', 'available', 'assigned', 'Demo assignment event.', now() - interval '90 days'),
  ('ae000000-0000-4000-8000-000000000002', 'DEMO-LIB-LT-003', 'returned', 'assigned', 'returned', 'Demo return receipt.', now() - interval '120 days'),
  ('ae000000-0000-4000-8000-000000000003', 'DEMO-LIB-LT-003', 'verified', 'returned', 'verified', 'Demo return verification.', now() - interval '119 days')
) as sample(id, asset_tag, action, previous_status, new_status, notes, created_at)
join public.assets asset on asset.asset_tag = sample.asset_tag
on conflict (id) do nothing;

-- Leave requests cover pending, approved, and rejected paths with synthetic notes.
insert into public.leave_balances (
  employee_id, leave_year, leave_type, entitled_days, carried_over_days
)
select employee.id, years.leave_year, sample.leave_type,
       sample.entitled_days, sample.carried_over_days
from (values
  ('DEMO-1001', 'Annual', 24.0, 2.0),
  ('DEMO-1003', 'Annual', 22.0, 0.0),
  ('DEMO-1005', 'Annual', 20.0, 1.0),
  ('DEMO-1010', 'Annual', 24.0, 0.0)
) as sample(employee_number, leave_type, entitled_days, carried_over_days)
join public.employees employee on employee.employee_number = sample.employee_number
cross join (values
  (extract(year from current_date)::integer - 1),
  (extract(year from current_date)::integer),
  (extract(year from current_date)::integer + 1)
) as years(leave_year)
on conflict (employee_id, leave_year, leave_type) do nothing;

insert into public.leave_requests (
  id, employee_id, leave_type, starts_on, ends_on, requested_days,
  reason, status, reviewed_at, review_notes, created_at, updated_at
)
select sample.id::uuid, employee.id, sample.leave_type, sample.starts_on,
       sample.ends_on, sample.requested_days, sample.reason, sample.status,
       sample.reviewed_at, sample.review_notes, sample.created_at,
       coalesce(sample.reviewed_at, sample.created_at)
from (values
  ('1e000000-0000-4000-8000-000000000001', 'DEMO-1001', 'Annual', current_date + 14, current_date + 16, 3.0, 'Demo pending leave request.', 'pending', null::timestamptz, null::text, now() - interval '2 days'),
  ('1e000000-0000-4000-8000-000000000002', 'DEMO-1003', 'Study', current_date - 60, current_date - 58, 3.0, 'Demo approved leave request.', 'approved', now() - interval '55 days', 'Demo approval.', now() - interval '58 days'),
  ('1e000000-0000-4000-8000-000000000003', 'DEMO-1005', 'Annual', current_date - 35, current_date - 33, 3.0, 'Demo rejected leave request.', 'rejected', now() - interval '30 days', 'Demo review completed.', now() - interval '33 days'),
  ('1e000000-0000-4000-8000-000000000004', 'DEMO-1010', 'Special', current_date - 12, current_date - 12, 1.0, 'Demo recently reviewed leave request.', 'approved', now() - interval '9 days', 'Demo approval.', now() - interval '11 days')
) as sample(id, employee_number, leave_type, starts_on, ends_on, requested_days, reason, status, reviewed_at, review_notes, created_at)
join public.employees employee on employee.employee_number = sample.employee_number
where not exists (
  select 1 from public.leave_requests existing where existing.id = sample.id::uuid
)
on conflict (id) do nothing;

insert into public.retention_interventions (
  id, employee_id, intervention_type, action_notes, follow_up_on, created_at
)
select
  'a1000000-0000-4000-8000-000000000001'::uuid,
  employee.id,
  'development',
  'Demo only: employee-requested development conversation recorded for workflow preview.',
  current_date + 30,
  now() - interval '7 days'
from public.employees employee
where employee.employee_number = 'DEMO-1006'
on conflict (id) do nothing;

insert into public.recruitment_openings (
  id, job_title, department_id, employment_category, status,
  positions, target_start_date, notes
)
select
  sample.id::uuid,
  sample.job_title,
  department.id,
  sample.employment_category,
  sample.status,
  sample.positions,
  sample.target_start_date,
  sample.notes
from (values
  ('b0000000-0000-4000-8000-000000000001', 'Demo ICT Support Officer', 'Information and Communication Technology', 'support', 'open', 1, current_date + 60, 'Fictional demo opening.'),
  ('b0000000-0000-4000-8000-000000000002', 'Demo Research Lecturer', 'Faculty of Engineering', 'academic', 'planned', 2, current_date + 120, 'Fictional demo opening.')
) as sample(id, job_title, department_name, employment_category, status, positions, target_start_date, notes)
join public.departments department on department.name = sample.department_name
on conflict (id) do nothing;

-- Capture a preview of the previous quarter where the report function exists.
select public.capture_quarterly_turnover_report();
