## Table `departments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  Unique |
| `code` | `text` |  Unique |
| `description` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `full_name` | `text` |  Nullable |
| `role` | `text` |  |
| `department_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `employees`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `employee_number` | `text` |  Unique |
| `full_name` | `text` |  |
| `email` | `text` |  Nullable |
| `job_title` | `text` |  Nullable |
| `department_id` | `uuid` |  Nullable |
| `employment_status` | `text` |  |
| `joined_on` | `date` |  Nullable |
| `exit_date` | `date` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `exit_requests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `employee_id` | `uuid` |  |
| `reason` | `text` |  |
| `last_day` | `date` |  Nullable |
| `status` | `text` |  |
| `submitted_on` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `clearance_steps`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `exit_request_id` | `uuid` |  |
| `department` | `text` |  |
| `status` | `text` |  |
| `step_order` | `int4` |  |
| `comments` | `text` |  Nullable |
| `approved_by` | `uuid` |  Nullable |
| `approved_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `knowledge_documents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `employee_id` | `uuid` |  |
| `title` | `text` |  |
| `category` | `text` |  Nullable |
| `storage_path` | `text` |  Unique |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `exit_request_id` | `uuid` |  Nullable |
| `status` | `text` |  |
| `verified_by` | `uuid` |  Nullable |
| `verified_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `assets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `asset_tag` | `text` |  Unique |
| `asset_type` | `text` |  |
| `description` | `text` |  Nullable |
| `status` | `text` |  |
| `employee_id` | `uuid` |  Nullable |
| `returned_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `assigned_to` | `uuid` |  Nullable |
| `verified_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `asset_history`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `asset_id` | `uuid` |  |
| `action` | `text` |  |
| `actor_id` | `uuid` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `audit_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `actor_id` | `uuid` |  Nullable |
| `action` | `text` |  |
| `entity_type` | `text` |  |
| `entity_id` | `uuid` |  Nullable |
| `metadata` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `system_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `value` | `text` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `notifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `type` | `text` |  |
| `title` | `text` |  |
| `message` | `text` |  |
| `entity_type` | `text` |  Nullable |
| `entity_id` | `text` |  Nullable |
| `read_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `role_permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `role_name` | `text` |  |
| `permission_name` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## RLS Policies

### `notifications`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access_notifications` | ALL | public | PERMISSIVE | `false` | `false` |

### `system_settings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins_full_access` | ALL | public | PERMISSIVE | `(COALESCE((auth.jwt() ->> 'role'::text), 'employee'::text) = ANY (ARRAY['Administrator'::text, 'HR'::text]))` | `(COALESCE((auth.jwt() ->> 'role'::text), 'employee'::text) = ANY (ARRAY['Administrator'::text, 'HR'::text]))` |

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `employee_self_profile` | ALL | public | PERMISSIVE | `(auth.uid() = id)` | `(auth.uid() = id)` |
| `Profiles are editable by owner` | UPDATE | public | PERMISSIVE | `(auth.uid() = id)` | `(auth.uid() = id)` |
| `Profiles are viewable by owner or admins` | SELECT | public | PERMISSIVE | `((auth.uid() = id) OR (EXISTS ( SELECT 1    FROM profiles p   WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['Administrator'::text, 'HR Manager'::text, 'Operations Manager'::text]))))))` | — |

### `asset_history`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access_asset_history` | ALL | public | PERMISSIVE | `false` | `false` |
| `Asset history readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `audit_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `audit_append_only` | INSERT | public | PERMISSIVE | — | `(COALESCE((auth.jwt() ->> 'role'::text), 'employee'::text) = ANY (ARRAY['Administrator'::text, 'HR'::text]))` |
| `read_all_audit_for_admins` | SELECT | public | PERMISSIVE | `(COALESCE((auth.jwt() ->> 'role'::text), 'employee'::text) = ANY (ARRAY['Administrator'::text, 'HR'::text, 'Management'::text]))` | — |
| `Audit events readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `employees`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access` | ALL | public | PERMISSIVE | `false` | `false` |
| `managers_read_all` | SELECT | public | PERMISSIVE | `(COALESCE((auth.jwt() ->> 'role'::text), 'employee'::text) = ANY (ARRAY['Administrator'::text, 'HR'::text, 'Management'::text]))` | — |
| `employee_self_records` | SELECT | public | PERMISSIVE | `((email = (( SELECT users.email    FROM auth.users   WHERE (users.id = auth.uid())))::text) OR (auth.uid() IS NOT NULL))` | — |
| `Employees writable by authenticated users` | INSERT | public | PERMISSIVE | — | `(auth.role() = 'authenticated'::text)` |
| `Employees readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `exit_requests`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access_exit` | ALL | public | PERMISSIVE | `false` | `false` |
| `Exit requests writable by authenticated users` | INSERT | public | PERMISSIVE | — | `(auth.role() = 'authenticated'::text)` |
| `Exit requests readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `clearance_steps`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access_clearances` | ALL | public | PERMISSIVE | `false` | `false` |
| `Clearance steps readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `assets`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access_assets` | ALL | public | PERMISSIVE | `false` | `false` |
| `Assets readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

### `knowledge_documents`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `deny_all_other_access_knowledge` | ALL | public | PERMISSIVE | `false` | `false` |
| `Knowledge documents readable by authenticated users` | SELECT | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | — |

