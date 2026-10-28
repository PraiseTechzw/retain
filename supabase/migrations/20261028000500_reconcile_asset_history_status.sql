-- Repair installations where asset_history predates the core schema migration.
-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
alter table public.asset_history
  add column if not exists previous_status text;

alter table public.asset_history
  add column if not exists new_status text;
