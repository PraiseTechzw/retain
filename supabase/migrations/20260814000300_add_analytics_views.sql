-- Analytics and reporting foundation.

create or replace view public.employee_turnover_summary as
select
  date_trunc('month', coalesce(exit_date, created_at)) as month,
  count(*) as total_employees,
  sum(case when employment_status = 'exited' then 1 else 0 end) as exited_count
from public.employees
group by date_trunc('month', coalesce(exit_date, created_at));

create or replace view public.exit_reason_summary as
select
  reason as exit_reason,
  count(*) as total_requests
from public.exit_requests
where reason is not null
group by reason;

create or replace view public.clearance_status_summary as
select
  department,
  status,
  count(*) as total_steps
from public.clearance_steps
group by department, status;

create or replace view public.asset_recovery_summary as
select
  status,
  count(*) as total_assets
from public.assets
group by status;

create or replace view public.knowledge_retention_summary as
select
  status,
  count(*) as total_documents
from public.knowledge_documents
group by status;
