create or replace function public.get_assets_missing_daily_checks(
  p_check_date date
)
returns table (
  asset_tag text,
  asset_type text,
  current_location text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select asset.asset_tag, asset.asset_type, asset.current_location
  from public.assets asset
  where asset.status = 'assigned'
    and asset.assigned_to is not null
    and not exists (
      select 1
      from public.asset_daily_logs daily_log
      where daily_log.asset_id = asset.id
        and daily_log.event_type = 'daily_check'
        and daily_log.logged_on = p_check_date
    )
  order by asset.asset_tag;
$$;

revoke all on function public.get_assets_missing_daily_checks(date)
  from public, anon, authenticated;
grant execute on function public.get_assets_missing_daily_checks(date)
  to service_role;