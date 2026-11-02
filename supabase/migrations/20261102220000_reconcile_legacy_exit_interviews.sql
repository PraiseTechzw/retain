do $$
begin
  if to_regclass('public.exit_interviews') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'exit_interviews'
         and column_name = 'exit_case_id'
     ) then
    alter table public.exit_interviews
      add column exit_case_id uuid references public.exit_cases(id) on delete cascade,
      add column interview_date date,
      add column responses jsonb,
      add column would_return boolean;

    update public.exit_interviews
    set
      exit_case_id = exit_request_id,
      interview_date = coalesce(scheduled_for::date, created_at::date),
      responses = jsonb_build_object(
        'additional_comments', coalesce(notes, '')
      )
    where exit_case_id is null;

    alter table public.exit_interviews
      alter column exit_case_id set not null,
      alter column interview_date set default current_date,
      alter column responses set default '{}'::jsonb,
      alter column responses set not null;

    create unique index exit_interviews_exit_case_id_key
      on public.exit_interviews (exit_case_id);
  end if;
end $$;
