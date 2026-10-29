-- CUT-HRMERS development-only reference data.
-- Create authentication users through Supabase Auth, then link their profiles
-- and employee records through the application or an approved import process.

insert into public.departments (name, code) values
  ('Human Resources', 'HR'),
  ('Faculty of Engineering', 'ENG'),
  ('Faculty of Business Sciences', 'BUS'),
  ('Faculty of Science and Technology', 'FST')
on conflict (name) do nothing;
