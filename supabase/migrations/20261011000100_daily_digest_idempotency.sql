begin;

do $$
begin
  if exists (
    select 1
    from public.notifications
    where entity_type = 'daily_digest'
      and entity_id is not null
    group by user_id, entity_type, entity_id
    having count(*) > 1
  ) then
    raise exception 'Resolve duplicate daily digest notifications before applying this migration';
  end if;
end;
$$;

create unique index if not exists notifications_daily_digest_once_per_user_date
  on public.notifications (user_id, entity_type, entity_id)
  where entity_type = 'daily_digest' and entity_id is not null;

commit;
