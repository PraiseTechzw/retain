begin;

create or replace function public.get_configured_clearance_departments()
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_raw text;
  v_input text[];
  v_departments text[];
  v_json jsonb;
begin
  select value into v_raw
  from public.system_settings
  where key = 'default_clearance_departments';

  if v_raw is null or btrim(v_raw) = '' then
    v_input := array['ICT', 'Library', 'Finance', 'Department head', 'Knowledge'];
  elsif left(btrim(v_raw), 1) = '[' then
    begin
      v_json := v_raw::jsonb;
      if jsonb_typeof(v_json) <> 'array' then
        raise exception 'Clearance departments must be a JSON array';
      end if;
      select array_agg(item.value order by item.ordinality)
      into v_input
      from jsonb_array_elements_text(v_json) with ordinality as item(value, ordinality);
    exception when others then
      v_input := null;
    end;
  else
    v_input := regexp_split_to_array(v_raw, E'[,\n]+');
  end if;

  if coalesce(cardinality(v_input), 0) = 0 then
    v_input := array['ICT', 'Library', 'Finance', 'Department head', 'Knowledge'];
  end if;

  select array_agg(item.department order by item.ordinality)
  into v_departments
  from (
    select distinct on (lower(btrim(raw.value)))
      btrim(raw.value) as department,
      raw.ordinality
    from unnest(v_input) with ordinality as raw(value, ordinality)
    where btrim(raw.value) <> ''
    order by lower(btrim(raw.value)), raw.ordinality
  ) as item;

  if coalesce(cardinality(v_departments), 0) = 0 then
    v_departments := array['ICT', 'Library', 'Finance', 'Department head', 'Knowledge'];
  end if;

  if cardinality(v_departments) > 20 or exists (
    select 1 from unnest(v_departments) as item(department)
    where length(item.department) > 80
  ) then
    raise exception 'Clearance configuration exceeds the supported limits';
  end if;

  return v_departments;
end;
$$;

revoke all on function public.get_configured_clearance_departments() from public, anon, authenticated;

alter table public.exit_requests
  add column if not exists clearance_departments text[];

update public.exit_requests
set clearance_departments = public.get_configured_clearance_departments()
where clearance_departments is null or cardinality(clearance_departments) = 0;

alter table public.exit_requests
  alter column clearance_departments set not null;

create or replace function public.set_exit_clearance_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.clearance_departments := public.get_configured_clearance_departments();
  elsif new.clearance_departments is distinct from old.clearance_departments then
    raise exception 'Required clearance departments are immutable after exit submission';
  end if;
  return new;
end;
$$;

revoke all on function public.set_exit_clearance_snapshot() from public, anon, authenticated;
drop trigger if exists set_exit_clearance_snapshot on public.exit_requests;
create trigger set_exit_clearance_snapshot
before insert or update on public.exit_requests
for each row execute function public.set_exit_clearance_snapshot();

create or replace function public.provision_exit_clearance_steps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.clearance_steps (exit_request_id, department, step_order, status)
  select new.id, item.department, item.ordinality::integer, 'pending'
  from unnest(new.clearance_departments) with ordinality as item(department, ordinality)
  on conflict (exit_request_id, department) do nothing;
  return new;
end;
$$;

revoke all on function public.provision_exit_clearance_steps() from public, anon, authenticated;
drop trigger if exists provision_exit_clearance_steps on public.exit_requests;
create trigger provision_exit_clearance_steps
after insert on public.exit_requests
for each row execute function public.provision_exit_clearance_steps();

-- Backfill active historical exits from their stored clearance snapshot. The
-- insert is in the same migration transaction and uses the existing unique key.
insert into public.clearance_steps (exit_request_id, department, step_order, status)
select er.id, item.department, item.ordinality::integer, 'pending'
from public.exit_requests er
cross join lateral unnest(er.clearance_departments) with ordinality as item(department, ordinality)
where er.status not in ('completed', 'rejected', 'cancelled')
on conflict (exit_request_id, department) do nothing;

create or replace function public.guard_exit_clearance_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_finalizing_actor text := current_setting('cut.elams_exit_finalization', true);
begin
  if new.clearance_departments is distinct from old.clearance_departments then
    raise exception 'Required clearance departments cannot be changed';
  end if;

  if old.status = 'completed' and new.status is distinct from old.status then
    raise exception 'A completed exit request is immutable';
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed'
    and v_finalizing_actor is distinct from auth.uid()::text then
    raise exception 'Exit completion must use the authorized finalization workflow';
  end if;

  if (
    new.completed_at is distinct from old.completed_at
    or new.finalized_by is distinct from old.finalized_by
  ) and v_finalizing_actor is distinct from auth.uid()::text then
    raise exception 'Finalization fields are managed by the authorized workflow';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_exit_clearance_snapshot() from public, anon, authenticated;
drop trigger if exists guard_exit_clearance_snapshot on public.exit_requests;
create trigger guard_exit_clearance_snapshot
before update on public.exit_requests
for each row execute function public.guard_exit_clearance_snapshot();

create or replace function public.can_finalize_exit(p_exit_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blockers jsonb := '[]'::jsonb;
  v_exit record;
  v_step record;
  v_asset record;
  v_requirement record;
  v_requirement_count integer := 0;
  v_approved_document_count integer := 0;
begin
  select er.id, er.employee_id, er.status, er.clearance_departments,
         e.department_id, e.employment_category, e.is_technical
  into v_exit
  from public.exit_requests er
  join public.employees e on e.id = er.employee_id
  where er.id = p_exit_request_id;

  if not found then
    raise exception 'Exit request or employee not found';
  end if;

  if coalesce(cardinality(v_exit.clearance_departments), 0) = 0 then
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'clearance',
      'message', 'No required clearance departments are recorded for this exit request.'
    );
  else
    for v_step in
      select expected.department
      from unnest(v_exit.clearance_departments) as expected(department)
      where not exists (
        select 1
        from public.clearance_steps step
        where step.exit_request_id = p_exit_request_id
          and lower(btrim(step.department)) = lower(btrim(expected.department))
      )
    loop
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'clearance',
        'department', v_step.department,
        'message', 'Required clearance step was not provisioned for ' || v_step.department
      );
    end loop;
  end if;

  for v_step in
    select department, status, comments
    from public.clearance_steps
    where exit_request_id = p_exit_request_id
      and status <> 'approved'
  loop
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'clearance',
      'department', v_step.department,
      'message', coalesce(v_step.comments, 'Clearance pending for ' || v_step.department)
    );
  end loop;

  for v_asset in
    select id, asset_tag
    from public.assets
    where assigned_to = v_exit.employee_id
      and (status <> 'verified' or returned_at is null or verified_at is null)
  loop
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'asset',
      'asset_id', v_asset.id,
      'asset_tag', v_asset.asset_tag,
      'message', 'Asset ' || v_asset.asset_tag || ' must be received and return-verified.'
    );
  end loop;

  for v_requirement in
    select kr.id, kr.name
    from public.knowledge_requirements kr
    where kr.active = true
      and kr.is_required = true
      and (kr.department_id is null or kr.department_id = v_exit.department_id)
      and (kr.employment_category is null or kr.employment_category = v_exit.employment_category)
  loop
    v_requirement_count := v_requirement_count + 1;
    if not exists (
      select 1
      from public.knowledge_documents kd
      where kd.employee_id = v_exit.employee_id
        and kd.requirement_id = v_requirement.id
        and kd.status in ('approved', 'verified')
    ) then
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'knowledge',
        'requirement_id', v_requirement.id,
        'message', 'Required knowledge handover is missing or unapproved: ' || v_requirement.name
      );
    end if;
  end loop;

  if v_exit.is_technical then
    select count(*)
    into v_approved_document_count
    from public.knowledge_documents kd
    where kd.employee_id = v_exit.employee_id
      and kd.status in ('approved', 'verified');

    if v_requirement_count = 0 then
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'knowledge',
        'message', 'No mandatory knowledge requirements are configured for this technical employee.'
      );
    end if;
    if v_approved_document_count = 0 then
      v_blockers := v_blockers || jsonb_build_object(
        'type', 'knowledge',
        'message', 'Technical staff must upload at least one approved knowledge handover document.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'eligible', jsonb_array_length(v_blockers) = 0,
    'blocked', jsonb_array_length(v_blockers) > 0,
    'blockers', v_blockers
  );
end;
$$;

create or replace function public.finalize_exit(p_exit_request_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_check jsonb;
  v_employee_id uuid;
  v_status text;
begin
  if auth.uid() is null or p_actor_id <> auth.uid() then
    raise exception 'Authenticated actor does not match the requested actor';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('administrator', 'hr')
      and active = true
  ) then
    raise exception 'Only active HR users or administrators can finalize exits';
  end if;

  select employee_id, status
  into v_employee_id, v_status
  from public.exit_requests
  where id = p_exit_request_id
  for update;
  if not found then
    raise exception 'Exit request not found';
  end if;
  if v_status not in ('submitted', 'under_review', 'clearance', 'blocked', 'eligible_for_finalization') then
    raise exception 'Only an open exit request can be finalized';
  end if;

  v_check := public.can_finalize_exit(p_exit_request_id);
  if v_check->>'eligible' <> 'true' then
    insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (
      p_actor_id,
      'finalization_blocked',
      'exit_request',
      p_exit_request_id::text,
      jsonb_build_object('blockers', v_check->'blockers')
    );
    return jsonb_build_object('success', false, 'blockers', v_check->'blockers');
  end if;

  perform set_config('cut.elams_exit_finalization', p_actor_id::text, true);
  update public.exit_requests
  set status = 'completed',
      completed_at = now(),
      finalized_by = p_actor_id,
      updated_at = now()
  where id = p_exit_request_id;

  update public.employees
  set employment_status = 'exited',
      exit_date = now(),
      updated_at = now()
  where id = v_employee_id;

  insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id,
    'finalized',
    'exit_request',
    p_exit_request_id::text,
    jsonb_build_object('employee_id', v_employee_id)
  );

  perform public.create_notification(
    p_actor_id,
    'success',
    'Exit finalized',
    'The exit request has been completed and the employee status updated.',
    'exit_request',
    p_exit_request_id::text
  );

  return jsonb_build_object('success', true, 'exit_request_id', p_exit_request_id);
end;
$$;

revoke execute on function public.can_finalize_exit(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_exit(uuid, uuid) from public, anon;
grant execute on function public.finalize_exit(uuid, uuid) to authenticated;

commit;
