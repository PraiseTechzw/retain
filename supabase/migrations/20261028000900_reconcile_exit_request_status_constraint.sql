do $$
declare
  invalid_statuses text[];
begin
  select array_agg(distinct status order by status)
  into invalid_statuses
  from public.exit_requests
  where status is null
     or status not in (
       'draft', 'submitted', 'under_review', 'clearance', 'blocked',
       'eligible_for_finalization', 'completed', 'rejected', 'cancelled'
     );

  if invalid_statuses is not null then
    raise exception 'Cannot reconcile exit request status constraint; map these existing statuses first: %', invalid_statuses;
  end if;
end;
$$;

-- Existing installations can retain the legacy status check because the core
-- migration uses CREATE TABLE IF NOT EXISTS for exit_requests.
alter table public.exit_requests
  drop constraint if exists exit_requests_status_check;
alter table public.exit_requests
  drop constraint if exists exit_requests_status_chk;
alter table public.exit_requests
  add constraint exit_requests_status_chk
  check (status in (
    'draft', 'submitted', 'under_review', 'clearance', 'blocked',
    'eligible_for_finalization', 'completed', 'rejected', 'cancelled'
  ));
