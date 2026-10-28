do $$
declare
  invalid_statuses text[];
begin
  select array_agg(distinct status order by status)
  into invalid_statuses
  from public.assets
  where status is null
     or status not in ('available', 'assigned', 'returned', 'retired', 'damaged', 'lost', 'verified');

  if invalid_statuses is not null then
    raise exception 'Cannot reconcile assets status constraint; map these existing statuses first: %', invalid_statuses;
  end if;
end;
$$;

-- Existing installations may retain the legacy check even though CREATE TABLE
-- IF NOT EXISTS in the core migration does not replace it.
alter table public.assets
  drop constraint if exists assets_status_check;
alter table public.assets
  drop constraint if exists assets_status_chk;
alter table public.assets
  add constraint assets_status_chk
  check (status in ('available', 'assigned', 'returned', 'retired', 'damaged', 'lost', 'verified'));
