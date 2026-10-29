alter table public.leave_balances
  add column if not exists updated_at timestamptz not null default now();
