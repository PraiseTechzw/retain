create or replace function public.get_leave_processing_target_metrics()
returns table (
  baseline_days numeric,
  current_average_days numeric,
  reviewed_request_count bigint,
  pending_request_count bigint,
  reduction_percent numeric,
  measurement_start date,
  measurement_end date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_baseline numeric;
  v_current_average numeric;
  v_reviewed_count bigint;
  v_pending_count bigint;
  v_start date;
  v_end date;
begin
  if v_role not in ('administrator', 'hr', 'management') then
    raise exception 'Not authorized to view leave processing metrics';
  end if;

  select case
    when setting.value ~ '^[0-9]+([.][0-9]+)?$' then setting.value::numeric
    else null
  end
  into v_baseline
  from public.system_settings setting
  where setting.key = 'leave_processing_baseline_days';

  select case
    when setting.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then setting.value::date
    else null
  end
  into v_start
  from public.system_settings setting
  where setting.key = 'leave_processing_baseline_recorded_on';
  v_start := coalesce(v_start, (current_date - interval '6 months')::date);
  v_end := least(current_date, (v_start + interval '6 months')::date);

  select
    avg(greatest(0, extract(epoch from (request.reviewed_at - request.created_at)) / 86400)),
    count(*)
  into v_current_average, v_reviewed_count
  from public.leave_requests request
  where request.reviewed_at >= v_start::timestamptz
    and request.reviewed_at < (v_end + 1)::timestamptz;

  select count(*)
  into v_pending_count
  from public.leave_requests request
  where request.status = 'pending';

  return query select
    v_baseline,
    round(v_current_average, 1),
    coalesce(v_reviewed_count, 0),
    coalesce(v_pending_count, 0),
    case when v_baseline > 0 and v_current_average is not null
      then round(((v_baseline - v_current_average) / v_baseline) * 100, 1)
      else null
    end,
    v_start,
    v_end;
end;
$$;

revoke all on function public.get_leave_processing_target_metrics()
  from public, anon;
grant execute on function public.get_leave_processing_target_metrics()
  to authenticated;
