-- LOCAL TEST DATA ONLY.
-- These Zimbabwe university-context records are synthetic and are not official
-- Chinhoyi University of Technology personnel, vacancy, or exit records.
-- Do not run this file against production or present its rows as institutional data.

create table if not exists public.recruitment_openings (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  employment_category text not null,
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'planned'
    check (status in ('planned', 'open', 'shortlisting', 'interviewing', 'offered', 'filled', 'cancelled')),
  positions integer not null default 1 check (positions > 0),
  target_start_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recruitment_openings enable row level security;

drop policy if exists "recruitment openings read" on public.recruitment_openings;
create policy "recruitment openings read"
  on public.recruitment_openings for select to authenticated
  using ((select public.hrms_is_hr()));

drop policy if exists "recruitment openings manage" on public.recruitment_openings;
create policy "recruitment openings manage"
  on public.recruitment_openings for all to authenticated
  using ((select public.hrms_is_hr()))
  with check ((select public.hrms_is_hr()));

insert into public.departments (name, code)
values
  ('Human Resources', 'HR'),
  ('Faculty of Engineering', 'ENG'),
  ('Faculty of Business Sciences', 'BUS'),
  ('Faculty of Science and Technology', 'FST'),
  ('Information and Communication Technology', 'ICT'),
  ('Library Services', 'LIB'),
  ('Research and Innovation', 'R&I')
on conflict (name) do nothing;

insert into public.employees (
  id, employee_number, full_name, email, department_id, job_title,
  staff_category, employment_type, employment_status, appointment_date, exit_date
)
values
  ('10000000-0000-0000-0000-000000000001', 'TEST-CUT-2301', 'Tafadzwa Muchengeti', 'tafadzwa.muchengeti@example.invalid', (select id from public.departments where code = 'ENG'), 'Lecturer', 'academic', 'permanent', 'active', '2023-01-09', null),
  ('10000000-0000-0000-0000-000000000002', 'TEST-CUT-2302', 'Chiedza Ndlovu', 'chiedza.ndlovu@example.invalid', (select id from public.departments where code = 'BUS'), 'Lecturer', 'academic', 'permanent', 'active', '2023-02-13', null),
  ('10000000-0000-0000-0000-000000000003', 'TEST-CUT-2303', 'Kudzai Moyo', 'kudzai.moyo@example.invalid', (select id from public.departments where code = 'FST'), 'Laboratory Technician', 'non_academic', 'permanent', 'active', '2023-03-06', null),
  ('10000000-0000-0000-0000-000000000004', 'TEST-CUT-2304', 'Rutendo Chikore', 'rutendo.chikore@example.invalid', (select id from public.departments where code = 'ICT'), 'Systems Analyst', 'non_academic', 'permanent', 'active', '2023-04-17', null),
  ('10000000-0000-0000-0000-000000000005', 'TEST-CUT-2305', 'Farai Mutsvairo', 'farai.mutsvairo@example.invalid', (select id from public.departments where code = 'HR'), 'HR Officer', 'non_academic', 'permanent', 'active', '2023-05-08', null),
  ('10000000-0000-0000-0000-000000000006', 'TEST-CUT-2306', 'Nyasha Dube', 'nyasha.dube@example.invalid', (select id from public.departments where code = 'LIB'), 'Senior Librarian', 'non_academic', 'permanent', 'active', '2023-06-12', null),
  ('10000000-0000-0000-0000-000000000007', 'TEST-CUT-2401', 'Tinashe Chiwara', 'tinashe.chiwara@example.invalid', (select id from public.departments where code = 'ENG'), 'Senior Lecturer', 'academic', 'permanent', 'active', '2024-01-15', null),
  ('10000000-0000-0000-0000-000000000008', 'TEST-CUT-2402', 'Anesu Sibanda', 'anesu.sibanda@example.invalid', (select id from public.departments where code = 'BUS'), 'Accounts Officer', 'non_academic', 'permanent', 'active', '2024-02-05', null),
  ('10000000-0000-0000-0000-000000000009', 'TEST-CUT-2403', 'Munashe Gwete', 'munashe.gwete@example.invalid', (select id from public.departments where code = 'FST'), 'Research Fellow', 'academic', 'contract', 'active', '2024-03-11', null),
  ('10000000-0000-0000-0000-000000000010', 'TEST-CUT-2404', 'Blessing Chikasha', 'blessing.chikasha@example.invalid', (select id from public.departments where code = 'ICT'), 'Network Administrator', 'non_academic', 'permanent', 'active', '2024-04-22', null),
  ('10000000-0000-0000-0000-000000000011', 'TEST-CUT-2501', 'Mariam Chigumba', 'mariam.chigumba@example.invalid', (select id from public.departments where code = 'ENG'), 'Lecturer', 'academic', 'contract', 'active', '2025-01-13', null),
  ('10000000-0000-0000-0000-000000000012', 'TEST-CUT-2502', 'Takudzwa Mhlanga', 'takudzwa.mhlanga@example.invalid', (select id from public.departments where code = 'R&I'), 'Research Administrator', 'non_academic', 'permanent', 'active', '2025-02-10', null),
  ('10000000-0000-0000-0000-000000000013', 'TEST-CUT-2307', 'Simbarashe Zuze', 'simbarashe.zuze@example.invalid', (select id from public.departments where code = 'ENG'), 'Assistant Lecturer', 'academic', 'contract', 'exited', '2023-02-06', '2023-11-30'),
  ('10000000-0000-0000-0000-000000000014', 'TEST-CUT-2308', 'Loveness Nyoni', 'loveness.nyoni@example.invalid', (select id from public.departments where code = 'BUS'), 'Procurement Assistant', 'non_academic', 'contract', 'exited', '2023-03-20', '2023-12-15'),
  ('10000000-0000-0000-0000-000000000015', 'TEST-CUT-2405', 'Washington Marufu', 'washington.marufu@example.invalid', (select id from public.departments where code = 'FST'), 'Laboratory Technician', 'non_academic', 'contract', 'exited', '2024-01-08', '2024-10-31'),
  ('10000000-0000-0000-0000-000000000016', 'TEST-CUT-2406', 'Shamiso Mutasa', 'shamiso.mutasa@example.invalid', (select id from public.departments where code = 'ICT'), 'Software Developer', 'non_academic', 'contract', 'exited', '2024-02-19', '2024-11-29'),
  ('10000000-0000-0000-0000-000000000017', 'TEST-CUT-2503', 'Admire Chirwa', 'admire.chirwa@example.invalid', (select id from public.departments where code = 'ENG'), 'Lecturer', 'academic', 'contract', 'exited', '2025-01-20', '2025-09-30'),
  ('10000000-0000-0000-0000-000000000018', 'TEST-CUT-2504', 'Ropafadzo Maseko', 'ropafadzo.maseko@example.invalid', (select id from public.departments where code = 'BUS'), 'Finance Officer', 'non_academic', 'contract', 'exited', '2025-02-17', '2025-10-31')
on conflict (employee_number) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  department_id = excluded.department_id,
  job_title = excluded.job_title,
  employment_status = excluded.employment_status,
  appointment_date = excluded.appointment_date,
  exit_date = excluded.exit_date;

-- Additional synthetic staff rows provide enough departmental and quarterly
-- volume for local turnover, retention, and vacancy analysis.
insert into public.employees (
  id, employee_number, full_name, email, department_id, job_title,
  staff_category, employment_type, employment_status, appointment_date, exit_date
)
values
  ('10000000-0000-0000-0000-000000000019', 'TEST-CUT-2309', 'Chipo Mavhunga', 'chipo.mavhunga@example.invalid', (select id from public.departments where code = 'ENG'), 'Teaching Assistant', 'academic', 'contract', 'exited', '2023-07-03', '2024-06-28'),
  ('10000000-0000-0000-0000-000000000020', 'TEST-CUT-2310', 'Darlington Gutu', 'darlington.gutu@example.invalid', (select id from public.departments where code = 'ENG'), 'Workshop Technologist', 'non_academic', 'permanent', 'active', '2023-08-14', null),
  ('10000000-0000-0000-0000-000000000021', 'TEST-CUT-2311', 'Memory Chisango', 'memory.chisango@example.invalid', (select id from public.departments where code = 'ENG'), 'Lecturer', 'academic', 'permanent', 'active', '2023-09-11', null),
  ('10000000-0000-0000-0000-000000000022', 'TEST-CUT-2312', 'Blessing Nyamukapa', 'blessing.nyamukapa@example.invalid', (select id from public.departments where code = 'ENG'), 'Administrative Assistant', 'non_academic', 'permanent', 'active', '2023-10-02', null),
  ('10000000-0000-0000-0000-000000000023', 'TEST-CUT-2407', 'Tendai Chiweshe', 'tendai.chiweshe@example.invalid', (select id from public.departments where code = 'ENG'), 'Professor', 'academic', 'permanent', 'active', '2024-05-06', null),
  ('10000000-0000-0000-0000-000000000024', 'TEST-CUT-2408', 'Eunice Masara', 'eunice.masara@example.invalid', (select id from public.departments where code = 'ENG'), 'Faculty Administrator', 'non_academic', 'permanent', 'active', '2024-06-17', null),
  ('10000000-0000-0000-0000-000000000025', 'TEST-CUT-2410', 'Leonard Chikosi', 'leonard.chikosi@example.invalid', (select id from public.departments where code = 'ENG'), 'Lecturer', 'academic', 'contract', 'active', '2024-09-09', null),
  ('10000000-0000-0000-0000-000000000026', 'TEST-CUT-2510', 'Makanaka Dzingirai', 'makanaka.dzingirai@example.invalid', (select id from public.departments where code = 'ENG'), 'Laboratory Assistant', 'non_academic', 'contract', 'active', '2025-08-04', null),
  ('10000000-0000-0000-0000-000000000027', 'TEST-CUT-2313', 'Lilian Mupfumi', 'lilian.mupfumi@example.invalid', (select id from public.departments where code = 'BUS'), 'Lecturer', 'academic', 'permanent', 'active', '2023-07-10', null),
  ('10000000-0000-0000-0000-000000000028', 'TEST-CUT-2314', 'Tapiwa Churu', 'tapiwa.churu@example.invalid', (select id from public.departments where code = 'BUS'), 'Business Development Officer', 'non_academic', 'permanent', 'active', '2023-08-21', null),
  ('10000000-0000-0000-0000-000000000029', 'TEST-CUT-2315', 'Patience Mlambo', 'patience.mlambo@example.invalid', (select id from public.departments where code = 'BUS'), 'Senior Lecturer', 'academic', 'permanent', 'active', '2023-09-18', null),
  ('10000000-0000-0000-0000-000000000030', 'TEST-CUT-2316', 'Munashe Nyoni', 'munashe.nyoni@example.invalid', (select id from public.departments where code = 'BUS'), 'Examinations Officer', 'non_academic', 'permanent', 'active', '2023-10-09', null),
  ('10000000-0000-0000-0000-000000000031', 'TEST-CUT-2409', 'Sharon Chikunguru', 'sharon.chikunguru@example.invalid', (select id from public.departments where code = 'BUS'), 'Lecturer', 'academic', 'contract', 'exited', '2024-07-15', '2025-05-30'),
  ('10000000-0000-0000-0000-000000000032', 'TEST-CUT-2411', 'Panashe Mupako', 'panashe.mupako@example.invalid', (select id from public.departments where code = 'BUS'), 'Faculty Administrator', 'non_academic', 'permanent', 'active', '2024-10-07', null),
  ('10000000-0000-0000-0000-000000000033', 'TEST-CUT-2511', 'Rumbidzai Hove', 'rumbidzai.hove@example.invalid', (select id from public.departments where code = 'BUS'), 'Teaching Assistant', 'academic', 'contract', 'active', '2025-08-11', null),
  ('10000000-0000-0000-0000-000000000034', 'TEST-CUT-2512', 'Cuthbert Ncube', 'cuthbert.ncube@example.invalid', (select id from public.departments where code = 'BUS'), 'Procurement Officer', 'non_academic', 'permanent', 'active', '2025-09-01', null),
  ('10000000-0000-0000-0000-000000000035', 'TEST-CUT-2317', 'Ester Chikozho', 'ester.chikozho@example.invalid', (select id from public.departments where code = 'FST'), 'Lecturer', 'academic', 'permanent', 'active', '2023-07-17', null),
  ('10000000-0000-0000-0000-000000000036', 'TEST-CUT-2318', 'Tinashe Maposa', 'tinashe.maposa@example.invalid', (select id from public.departments where code = 'FST'), 'Laboratory Technologist', 'non_academic', 'permanent', 'active', '2023-08-28', null),
  ('10000000-0000-0000-0000-000000000037', 'TEST-CUT-2319', 'Nyaradzo Chikwanha', 'nyaradzo.chikwanha@example.invalid', (select id from public.departments where code = 'FST'), 'Research Fellow', 'academic', 'contract', 'exited', '2023-09-25', '2024-08-30'),
  ('10000000-0000-0000-0000-000000000038', 'TEST-CUT-2320', 'Tawanda Mupfeka', 'tawanda.mupfeka@example.invalid', (select id from public.departments where code = 'FST'), 'Laboratory Assistant', 'non_academic', 'contract', 'active', '2023-10-16', null),
  ('10000000-0000-0000-0000-000000000039', 'TEST-CUT-2412', 'Brenda Mutsau', 'brenda.mutsau@example.invalid', (select id from public.departments where code = 'FST'), 'Senior Lecturer', 'academic', 'permanent', 'active', '2024-09-16', null),
  ('10000000-0000-0000-0000-000000000040', 'TEST-CUT-2413', 'Itai Chinyoka', 'itai.chinyoka@example.invalid', (select id from public.departments where code = 'FST'), 'Science Technician', 'non_academic', 'permanent', 'active', '2024-10-14', null),
  ('10000000-0000-0000-0000-000000000041', 'TEST-CUT-2513', 'Elvis Chikore', 'elvis.chikore@example.invalid', (select id from public.departments where code = 'FST'), 'Lecturer', 'academic', 'contract', 'active', '2025-09-08', null),
  ('10000000-0000-0000-0000-000000000042', 'TEST-CUT-2514', 'Rumbidzai Dube', 'rumbidzai.dube@example.invalid', (select id from public.departments where code = 'FST'), 'Research Assistant', 'academic', 'contract', 'active', '2025-10-06', null),
  ('10000000-0000-0000-0000-000000000043', 'TEST-CUT-2321', 'Morris Chiweshe', 'morris.chiweshe@example.invalid', (select id from public.departments where code = 'ICT'), 'Database Administrator', 'non_academic', 'permanent', 'active', '2023-11-06', null),
  ('10000000-0000-0000-0000-000000000044', 'TEST-CUT-2414', 'Lydia Mupinga', 'lydia.mupinga@example.invalid', (select id from public.departments where code = 'ICT'), 'ICT Support Officer', 'non_academic', 'permanent', 'active', '2024-09-23', null),
  ('10000000-0000-0000-0000-000000000045', 'TEST-CUT-2415', 'Pauline Ncube', 'pauline.ncube@example.invalid', (select id from public.departments where code = 'ICT'), 'Business Analyst', 'non_academic', 'permanent', 'exited', '2024-10-21', '2025-06-27'),
  ('10000000-0000-0000-0000-000000000046', 'TEST-CUT-2515', 'Tonderai Moyo', 'tonderai.moyo@example.invalid', (select id from public.departments where code = 'ICT'), 'Cybersecurity Officer', 'non_academic', 'permanent', 'active', '2025-10-13', null),
  ('10000000-0000-0000-0000-000000000047', 'TEST-CUT-2322', 'Sithembiso Dube', 'sithembiso.dube@example.invalid', (select id from public.departments where code = 'HR'), 'HR Assistant', 'non_academic', 'permanent', 'active', '2023-11-13', null),
  ('10000000-0000-0000-0000-000000000048', 'TEST-CUT-2416', 'Eunice Moyo', 'eunice.moyo@example.invalid', (select id from public.departments where code = 'HR'), 'Training Coordinator', 'non_academic', 'permanent', 'active', '2024-10-28', null),
  ('10000000-0000-0000-0000-000000000049', 'TEST-CUT-2516', 'Thembelani Ndlovu', 'thembelani.ndlovu@example.invalid', (select id from public.departments where code = 'HR'), 'HR Business Partner', 'non_academic', 'permanent', 'active', '2025-11-03', null),
  ('10000000-0000-0000-0000-000000000050', 'TEST-CUT-2323', 'Martha Chikosi', 'martha.chikosi@example.invalid', (select id from public.departments where code = 'LIB'), 'Library Assistant', 'non_academic', 'permanent', 'active', '2023-11-20', null),
  ('10000000-0000-0000-0000-000000000051', 'TEST-CUT-2417', 'Tariro Chikasha', 'tariro.chikasha@example.invalid', (select id from public.departments where code = 'LIB'), 'Digital Services Librarian', 'non_academic', 'permanent', 'active', '2024-11-04', null),
  ('10000000-0000-0000-0000-000000000052', 'TEST-CUT-2517', 'Nokuthula Moyo', 'nokuthula.moyo@example.invalid', (select id from public.departments where code = 'LIB'), 'Archives Officer', 'non_academic', 'contract', 'active', '2025-11-10', null),
  ('10000000-0000-0000-0000-000000000053', 'TEST-CUT-2324', 'Tapiwa Chuma', 'tapiwa.chuma@example.invalid', (select id from public.departments where code = 'R&I'), 'Research Assistant', 'academic', 'contract', 'active', '2023-12-04', null),
  ('10000000-0000-0000-0000-000000000054', 'TEST-CUT-2418', 'Shingirai Ncube', 'shingirai.ncube@example.invalid', (select id from public.departments where code = 'R&I'), 'Grants Officer', 'non_academic', 'permanent', 'active', '2024-11-11', null),
  ('10000000-0000-0000-0000-000000000055', 'TEST-CUT-2518', 'Netsai Moyo', 'netsai.moyo@example.invalid', (select id from public.departments where code = 'R&I'), 'Research Fellow', 'academic', 'contract', 'active', '2025-11-17', null),
  ('10000000-0000-0000-0000-000000000056', 'TEST-CUT-2601', 'Brian Chitambira', 'brian.chitambira@example.invalid', (select id from public.departments where code = 'ENG'), 'Lecturer', 'academic', 'contract', 'active', '2026-01-12', null),
  ('10000000-0000-0000-0000-000000000057', 'TEST-CUT-2602', 'Sharon Mupfudza', 'sharon.mupfudza@example.invalid', (select id from public.departments where code = 'BUS'), 'Accounts Assistant', 'non_academic', 'permanent', 'active', '2026-02-09', null),
  ('10000000-0000-0000-0000-000000000058', 'TEST-CUT-2603', 'Kudzai Chisango', 'kudzai.chisango@example.invalid', (select id from public.departments where code = 'FST'), 'Laboratory Technician', 'non_academic', 'contract', 'active', '2026-03-16', null),
  ('10000000-0000-0000-0000-000000000059', 'TEST-CUT-2604', 'Tatenda Moyo', 'tatenda.moyo@example.invalid', (select id from public.departments where code = 'ICT'), 'Systems Engineer', 'non_academic', 'permanent', 'active', '2026-04-13', null),
  ('10000000-0000-0000-0000-000000000060', 'TEST-CUT-2605', 'Mavis Ncube', 'mavis.ncube@example.invalid', (select id from public.departments where code = 'HR'), 'HR Officer', 'non_academic', 'permanent', 'active', '2026-05-11', null)
on conflict (employee_number) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  department_id = excluded.department_id,
  job_title = excluded.job_title,
  employment_status = excluded.employment_status,
  appointment_date = excluded.appointment_date,
  exit_date = excluded.exit_date;

-- Add 200 deterministic synthetic employees after the existing 69 records.
-- Of these new records, 150 (75%) are exited and 50 remain active.
insert into public.employees (
  id, employee_number, full_name, email, department_id, job_title,
  staff_category, employment_type, employment_status, appointment_date, exit_date
)
select
  md5('synthetic-employee-' || n)::uuid,
  'TEST-CUT-SYN-' || lpad(n::text, 3, '0'),
  format('Synthetic Zimbabwe Staff %s', lpad(n::text, 3, '0')),
  format('synthetic.staff.%s@example.invalid', lpad(n::text, 3, '0')),
  (select id from public.departments where code = (array['ENG', 'BUS', 'FST', 'ICT', 'HR', 'LIB', 'R&I'])[1 + ((n - 61) % 7)]),
  (array['Lecturer', 'Research Fellow', 'Laboratory Technician', 'Systems Analyst', 'Administrative Officer', 'Library Assistant', 'Finance Officer'])[1 + ((n - 61) % 7)],
  case when n % 3 = 0 then 'academic' else 'non_academic' end,
  case when n % 4 = 0 then 'permanent' else 'contract' end,
  case when n <= 219 then 'exited' else 'active' end,
  date '2018-01-01' + ((n - 61) * 9 % 1600),
  case when n <= 219 then date '2023-01-15' + ((n - 70) * 9 % 1200) end
from generate_series(70, 269) as numbers(n)
on conflict (employee_number) do update set
  id = excluded.id,
  full_name = excluded.full_name,
  email = excluded.email,
  department_id = excluded.department_id,
  job_title = excluded.job_title,
  staff_category = excluded.staff_category,
  employment_type = excluded.employment_type,
  employment_status = excluded.employment_status,
  appointment_date = excluded.appointment_date,
  exit_date = excluded.exit_date;

insert into public.exit_cases (
  id, employee_id, exit_type, classification, reason_category, reason,
  last_day, status
)
select
  md5('synthetic-exit-case-' || n)::uuid,
  md5('synthetic-employee-' || n)::uuid,
  case when n % 4 = 0 then 'contract_end' else 'resignation' end,
  case when n % 4 = 0 then 'administrative' else 'voluntary' end,
  case when n % 4 = 0 then 'contract_end' else (array['career_growth', 'compensation', 'relocation', 'workload'])[1 + ((n - 61) % 4)] end,
  case when n % 4 = 0
    then 'Synthetic fixed-term appointment ended.'
    else 'Synthetic employee moved to another opportunity.'
  end,
  date '2023-01-15' + ((n - 61) * 9 % 1200),
  'completed'
from generate_series(70, 219) as numbers(n)
on conflict (id) do update set
  employee_id = excluded.employee_id,
  exit_type = excluded.exit_type,
  classification = excluded.classification,
  reason_category = excluded.reason_category,
  reason = excluded.reason,
  last_day = excluded.last_day,
  status = excluded.status;

insert into public.exit_cases (
  id, employee_id, exit_type, classification, reason_category, reason,
  last_day, status
)
values
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000019', 'contract_end', 'administrative', 'contract_end', 'Synthetic fixed-term appointment ended.', '2024-06-28', 'completed'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000031', 'resignation', 'voluntary', 'career_growth', 'Synthetic move to another institution.', '2025-05-30', 'completed'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000037', 'contract_end', 'administrative', 'contract_end', 'Synthetic research appointment ended.', '2024-08-30', 'completed'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000045', 'resignation', 'voluntary', 'career_growth', 'Synthetic move to a national technology organisation.', '2025-06-27', 'completed'),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000020', 'resignation', 'voluntary', 'relocation', 'Synthetic relocation to another province.', '2025-12-19', 'completed'),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000028', 'resignation', 'voluntary', 'compensation', 'Synthetic move to a higher-paid opportunity.', '2026-01-30', 'completed'),
  ('20000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000035', 'contract_end', 'administrative', 'contract_end', 'Synthetic fixed-term appointment ended.', '2026-02-27', 'completed')
on conflict (id) do nothing;

insert into public.recruitment_openings (
  id, job_title, employment_category, department_id, status,
  positions, target_start_date, notes
)
values
  ('30000000-0000-0000-0000-000000000007', 'Assistant Lecturer in Electrical Engineering', 'academic', (select id from public.departments where code = 'ENG'), 'filled', 3, '2023-08-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000008', 'Workshop Technologist', 'support', (select id from public.departments where code = 'ENG'), 'interviewing', 2, '2024-02-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000009', 'Lecturer in Accounting', 'academic', (select id from public.departments where code = 'BUS'), 'filled', 2, '2024-03-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000010', 'Procurement Officer', 'support', (select id from public.departments where code = 'BUS'), 'offered', 1, '2025-01-15', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000011', 'Research Fellow in Applied Sciences', 'academic', (select id from public.departments where code = 'FST'), 'shortlisting', 2, '2025-02-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000012', 'Laboratory Assistant', 'support', (select id from public.departments where code = 'FST'), 'open', 2, '2025-03-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000013', 'Network Administrator', 'support', (select id from public.departments where code = 'ICT'), 'filled', 1, '2024-05-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000014', 'Software Developer', 'support', (select id from public.departments where code = 'ICT'), 'open', 2, '2026-02-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000015', 'HR Business Partner', 'support', (select id from public.departments where code = 'HR'), 'interviewing', 1, '2026-03-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000016', 'Training and Development Officer', 'support', (select id from public.departments where code = 'HR'), 'planned', 1, '2026-04-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000017', 'Digital Services Librarian', 'support', (select id from public.departments where code = 'LIB'), 'filled', 1, '2024-07-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000018', 'Library Assistant', 'support', (select id from public.departments where code = 'LIB'), 'open', 2, '2026-05-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000019', 'Grants and Partnerships Officer', 'support', (select id from public.departments where code = 'R&I'), 'shortlisting', 1, '2025-06-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000020', 'Research Assistant', 'academic', (select id from public.departments where code = 'R&I'), 'open', 4, '2026-06-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000021', 'Senior Lecturer in Mechatronics', 'academic', (select id from public.departments where code = 'ENG'), 'planned', 1, '2026-07-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000022', 'Finance Officer', 'support', (select id from public.departments where code = 'BUS'), 'cancelled', 1, '2025-07-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000023', 'Data Analyst', 'support', (select id from public.departments where code = 'ICT'), 'filled', 1, '2025-08-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000024', 'Postdoctoral Research Fellow', 'academic', (select id from public.departments where code = 'FST'), 'planned', 2, '2026-08-01', 'Synthetic local test vacancy for workforce trend workflows.')
on conflict (id) do nothing;

insert into public.exit_cases (
  id, employee_id, exit_type, classification, reason_category, reason,
  last_day, status
)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013', 'contract_end', 'administrative', 'contract_end', 'Synthetic fixed-term appointment ended.', '2023-11-30', 'completed'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000014', 'resignation', 'voluntary', 'career_growth', 'Synthetic move to another professional opportunity.', '2023-12-15', 'completed'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000015', 'contract_end', 'administrative', 'contract_end', 'Synthetic fixed-term appointment ended.', '2024-10-31', 'completed'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000016', 'resignation', 'voluntary', 'relocation', 'Synthetic relocation outside the province.', '2024-11-29', 'completed'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000017', 'contract_end', 'administrative', 'contract_end', 'Synthetic fixed-term appointment ended.', '2025-09-30', 'completed'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000018', 'resignation', 'voluntary', 'compensation', 'Synthetic move to a higher-paid opportunity.', '2025-10-31', 'completed')
on conflict (id) do nothing;

insert into public.recruitment_openings (
  id, job_title, employment_category, department_id, status,
  positions, target_start_date, notes
)
values
  ('30000000-0000-0000-0000-000000000001', 'Lecturer in Computer Systems Engineering', 'academic', (select id from public.departments where code = 'ENG'), 'filled', 2, '2023-08-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000002', 'Laboratory Technologist', 'support', (select id from public.departments where code = 'FST'), 'filled', 1, '2023-09-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000003', 'ICT Support Officer', 'support', (select id from public.departments where code = 'ICT'), 'filled', 1, '2023-10-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000004', 'Senior Lecturer in Business Management', 'academic', (select id from public.departments where code = 'BUS'), 'open', 1, '2024-01-15', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000005', 'Human Resources Officer', 'support', (select id from public.departments where code = 'HR'), 'shortlisting', 1, '2024-04-01', 'Synthetic local test vacancy for workforce trend workflows.'),
  ('30000000-0000-0000-0000-000000000006', 'Research Administration Coordinator', 'support', (select id from public.departments where code = 'R&I'), 'planned', 1, '2024-07-01', 'Synthetic local test vacancy for workforce trend workflows.')
on conflict (id) do nothing;
