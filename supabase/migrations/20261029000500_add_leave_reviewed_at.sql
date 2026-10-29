alter table public.leave_requests
  add column if not exists reviewed_at timestamptz;
