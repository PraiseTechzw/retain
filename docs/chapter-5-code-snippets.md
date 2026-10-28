# Chapter 5 code snippets

These excerpts are copied from the current CUT-Retain source. The daily notification function supports delivery at the configured schedule; its 07:00 UTC schedule is configured outside the Edge Function (for example, with Supabase Cron).

## Snippet 5.4: `finalize_exit`

Source: `supabase/migrations/20261011000200_exit_clearance_atomicity.sql`

```sql
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
    select 1 from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('administrator', 'hr')
      and active = true
  ) then
    raise exception 'Only active HR users or administrators can finalize exits';
  end if;

  select employee_id, status into v_employee_id, v_status
  from public.exit_requests where id = p_exit_request_id for update;
  if not found then raise exception 'Exit request not found'; end if;
  if v_status not in ('submitted', 'under_review', 'clearance', 'blocked', 'eligible_for_finalization') then
    raise exception 'Only an open exit request can be finalized';
  end if;

  v_check := public.can_finalize_exit(p_exit_request_id);
  if v_check->>'eligible' <> 'true' then
    insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (p_actor_id, 'finalization_blocked', 'exit_request', p_exit_request_id::text,
      jsonb_build_object('blockers', v_check->'blockers'));
    return jsonb_build_object('success', false, 'blockers', v_check->'blockers');
  end if;

  perform set_config('cut.elams_exit_finalization', p_actor_id::text, true);
  update public.exit_requests set status = 'completed', completed_at = now(),
    finalized_by = p_actor_id, updated_at = now() where id = p_exit_request_id;
  update public.employees set employment_status = 'exited', exit_date = now(),
    updated_at = now() where id = v_employee_id;
  insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'finalized', 'exit_request', p_exit_request_id::text,
    jsonb_build_object('employee_id', v_employee_id));
  perform public.create_notification(p_actor_id, 'success', 'Exit finalized',
    'The exit request has been completed and the employee status updated.',
    'exit_request', p_exit_request_id::text);
  return jsonb_build_object('success', true, 'exit_request_id', p_exit_request_id);
end;
$$;
```

## Snippet 5.5: RLS helpers and policy

Sources: `supabase/migrations/20261007001100_close_audit_findings.sql` and `supabase/migrations/20261006000900_lifecycle_operations.sql`.

```sql
create or replace function public.current_app_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select lower(role) from public.profiles where id = auth.uid() and active = true),
    'employee'
  );
$$;

drop policy if exists exit_requests_read_scope on public.exit_requests;
create policy exit_requests_read_scope on public.exit_requests
  for select using (
    public.current_app_active()
    and (
      public.current_app_role() in ('administrator', 'hr', 'management')
      or exists (
        select 1 from public.employees employee
        where employee.id = exit_requests.employee_id
          and employee.user_id = auth.uid()
      )
    )
  );
```

## Snippet 5.6: least-privilege profile creation trigger

Source: `supabase/migrations/20261011000000_security_leave_integrity.sql`.

```sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Employee'
    ),
    'Employee',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();
```

## Snippet 5.7: Daily digest Edge Function

Source: `supabase/functions/daily-notifications/index.ts`.

```ts
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? supabaseUrl;

if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
  throw new Error("Supabase and Resend notification secrets are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, text, html }),
  });
  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

// The handler counts outstanding exits, clearance steps, unverified documents,
// and assigned assets without a check for today's UTC date. Per-recipient
// delivery status is upserted in notification_delivery_log; a failed email is
// logged and does not prevent the in-app notification from being attempted.
```

Note: the actual handler begins at `Deno.serve` later in this file; the daily schedule is not set in the function source itself.

## Snippet 5.8: server-side error handling

The actions module catches audit-write failures so an audit transport error is logged server-side and does not expose internals to the browser. This is the current matching example; the project does not have a general `try/catch` wrapper around every server action.

Source: `lib/supabase/actions.ts`.

```ts
async function audit(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from("audit_events").insert({
      actor_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      metadata,
    });
    if (error) {
      console.error("Audit event write failed", {
        code: error.code, action, entityType,
      });
    }
  } catch (error) {
    console.error("Audit event write failed", {
      message: error instanceof Error ? error.message : "Unknown audit error",
      action,
      entityType,
    });
  }
}
```

## Snippet 5.9: server-side leave validation

Source: `lib/supabase/actions.ts` (`submitLeaveRequest`). Database triggers additionally enforce overlap and balance rules.

```ts
export async function submitLeaveRequest(formData: FormData) {
  const { supabase, user } = await actor();
  const leaveType = String(formData.get("leave_type") ?? "").trim();
  const startsOn = parseOptionalDate(String(formData.get("starts_on") ?? ""), "Leave start date");
  const endsOn = parseOptionalDate(String(formData.get("ends_on") ?? ""), "Leave end date");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!leaveType || !startsOn || !endsOn) throw new Error("Leave type and date range are required.");
  const start = new Date(`${startsOn}T00:00:00.000Z`);
  const end = new Date(`${endsOn}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Enter a valid leave date range.");
  }
  const { data: employee, error: employeeError } = await supabase
    .from("employees").select("id").eq("user_id", user.id).maybeSingle();
  if (employeeError || !employee) throw new Error("Your account is not linked to an employee record.");
  const { data: conflicts, error: conflictError } = await supabase
    .from("leave_requests").select("id").eq("employee_id", employee.id)
    .in("status", ["pending", "approved"]).lte("starts_on", endsOn)
    .gte("ends_on", startsOn).limit(1);
  if (conflictError) throw new Error("Unable to check for overlapping leave.");
  if (conflicts?.length) throw new Error("You already have a pending or approved leave request for these dates.");
  // Weekdays are counted and the database independently checks balance/overlap.
```

The action continues by counting weekdays, inserting the request, writing an audit event, and revalidating the leave and analytics pages.

## Snippet 5.10: unique daily asset check

Source: `supabase/migrations/20261011000000_security_leave_integrity.sql`.

```sql
create unique index if not exists asset_daily_logs_one_check_per_asset_day
  on public.asset_daily_logs (asset_id, logged_on)
  where event_type = 'daily_check';
```

## Snippet 5.11: sign-out action

Source: `lib/supabase/actions.ts`.

```ts
export async function signOut() {
  const { supabase } = await actor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}
```

## Items still requiring project evidence

- The draft's claims that the digest is scheduled daily at 07:00 UTC, that UAT participants and dates are known, and that all listed tests passed need deployment records or test evidence. They cannot be established from the source files alone.
- Figures 5.2–5.8 and appendix screenshots must be captured from a running system/test environment; no screenshots were present in the supplied draft or project files.
- `package.json` has no automated test script at present, so the suggested “automated tests running” screenshot cannot be produced from the current scripts without adding a test setup.
