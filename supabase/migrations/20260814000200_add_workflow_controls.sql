-- Workflow and governance controls for CUT-Retain.

create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  permission_name text not null,
  created_at timestamptz not null default now(),
  unique (role_name, permission_name)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text not null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists role_permissions_role_name_idx on role_permissions(role_name);
create index if not exists role_permissions_permission_name_idx on role_permissions(permission_name);
create index if not exists notifications_user_id_idx on notifications(user_id);

insert into role_permissions (role_name, permission_name)
values
  ('Administrator', 'manage_system_settings'),
  ('Administrator', 'finalize_exits'),
  ('Administrator', 'approve_clearance'),
  ('HR', 'manage_employees'),
  ('HR', 'finalize_exits'),
  ('HR', 'approve_clearance'),
  ('ICT', 'approve_ict_clearance'),
  ('Library', 'approve_library_clearance'),
  ('Management', 'view_reports'),
  ('Employee', 'view_own_profile'),
  ('Employee', 'view_own_exit_requests')
on conflict (role_name, permission_name) do nothing;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_entity_type text default null,
  p_entity_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.notifications(user_id, type, title, message, entity_type, entity_id, created_at)
  values (p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id, now())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.can_finalize_exit(p_exit_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocked boolean := false;
  v_blockers jsonb := '[]'::jsonb;
  v_step record;
  v_asset record;
  v_doc record;
begin
  for v_step in
    select department, status, comments
    from public.clearance_steps
    where exit_request_id = p_exit_request_id
      and status <> 'approved'
  loop
    v_blocked := true;
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'clearance',
      'department', v_step.department,
      'message', coalesce(v_step.comments, 'Clearance pending for ' || v_step.department)
    );
  end loop;

  for v_asset in
    select a.id, a.asset_tag, a.status
    from public.assets a
    join public.employees e on e.id = a.assigned_to
    join public.exit_requests er on er.employee_id = e.id
    where er.id = p_exit_request_id
      and a.status not in ('returned', 'verified')
  loop
    v_blocked := true;
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'asset',
      'asset_id', v_asset.id,
      'asset_tag', v_asset.asset_tag,
      'message', 'Asset ' || v_asset.asset_tag || ' has not been returned and verified.'
    );
  end loop;

  for v_doc in
    select id, title, status
    from public.knowledge_documents
    where exit_request_id = p_exit_request_id
      and status <> 'verified'
  loop
    v_blocked := true;
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'knowledge',
      'document_id', v_doc.id,
      'document_title', v_doc.title,
      'message', 'Knowledge handover document not verified: ' || v_doc.title
    );
  end loop;

  return jsonb_build_object(
    'eligible', not v_blocked,
    'blocked', v_blocked,
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
  v_exit_record record;
  v_employee_id uuid;
begin
  select * into v_exit_record from public.exit_requests where id = p_exit_request_id for update;

  if not found then
    raise exception 'Exit request not found';
  end if;

  v_check := public.can_finalize_exit(p_exit_request_id);
  if v_check->>'eligible' = 'false' then
    insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (p_actor_id, 'finalization_blocked', 'exit_request', p_exit_request_id::text, jsonb_build_object('blockers', v_check->'blockers'));
    return jsonb_build_object('success', false, 'blockers', v_check->'blockers');
  end if;

  update public.exit_requests
  set status = 'completed', completed_at = now(), finalized_by = p_actor_id, updated_at = now()
  where id = p_exit_request_id;

  select employee_id into v_employee_id from public.exit_requests where id = p_exit_request_id;

  update public.employees
  set employment_status = 'exited', exit_date = now(), updated_at = now()
  where id = v_employee_id;

  insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'finalized', 'exit_request', p_exit_request_id::text, jsonb_build_object('employee_id', v_employee_id));

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
