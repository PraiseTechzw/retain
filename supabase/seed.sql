-- CUT-HRMERS development-only reference data.
-- Create authentication users through Supabase Auth, then link their profiles
-- and employee records through the application or an approved import process.

insert into public.departments (name, code) values
  ('Human Resources', 'HR'),
  ('Faculty of Engineering', 'ENG'),
  ('Faculty of Business Sciences', 'BUS'),
  ('Faculty of Science and Technology', 'FST')
on conflict (name) do nothing;

insert into public.employees (
  id, employee_number, full_name, email, department_id, job_title,
  staff_category, employment_type, employment_status, appointment_date, exit_date
)
values
  ('00000000-0000-0000-0000-000000000101', 'CUT-1001', 'Tariro Moyo', 'tariro.moyo@cut.ac.zw',
   (select id from public.departments where code = 'ENG'), 'Senior Lecturer',
   'academic', 'permanent', 'exited', '2018-02-01', '2026-02-14'),
  ('00000000-0000-0000-0000-000000000102', 'CUT-1002', 'Farai Ncube', 'farai.ncube@cut.ac.zw',
   (select id from public.departments where code = 'BUS'), 'Accounts Officer',
   'non_academic', 'permanent', 'exited', '2020-06-15', '2026-04-30'),
  ('00000000-0000-0000-0000-000000000103', 'CUT-1003', 'Rudo Dube', 'rudo.dube@cut.ac.zw',
   (select id from public.departments where code = 'FST'), 'Laboratory Technician',
   'non_academic', 'contract', 'exited', '2023-01-09', '2026-08-21'),
  ('00000000-0000-0000-0000-000000000104', 'CUT-1004', 'Nyasha Chirwa', 'nyasha.chirwa@cut.ac.zw',
   (select id from public.departments where code = 'ENG'), 'Lecturer',
   'academic', 'permanent', 'active', '2024-01-15', null)
on conflict (employee_number) do nothing;

insert into public.exit_cases (
  id, employee_id, exit_type, classification, reason_category, reason,
  last_day, status
)
values
  ('00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0000-000000000101', 'resignation', 'voluntary',
   'career_growth', 'Accepted a senior role at another institution.',
   '2026-02-14', 'completed'),
  ('00000000-0000-0000-0000-000000000202',
   '00000000-0000-0000-0000-000000000102', 'resignation', 'voluntary',
   'compensation', 'Moved to a better compensated opportunity.',
   '2026-04-30', 'completed'),
  ('00000000-0000-0000-0000-000000000203',
   '00000000-0000-0000-0000-000000000103', 'contract_end', 'administrative',
   'contract_end', 'Fixed-term appointment ended.',
   '2026-08-21', 'completed')
on conflict (id) do nothing;
