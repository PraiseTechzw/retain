# CUT-ELAMS

CUT-ELAMS (the Retain application) is Chinhoyi University of Technology's employee lifecycle and asset management platform for secure employee records, recruitment mapping, leave, asset accountability, knowledge retention, and structured clearance workflows.

## Overview

The application helps organizations manage:

- employee profiles and role visibility
- department master data and governance
- exit and clearance workflows
- knowledge requirements and document tracking
- alerts, admin settings, and institutional controls

## Product goals

- centralize employee continuity information
- reduce risk during staff transitions
- make department assignment and access control manageable for administrators
- provide a clean operational dashboard for HR, management, and admin teams

## CUT-ELAMS lifecycle capabilities

The platform covers employee records, mapped recruitment openings, employee
self-service leave requests and HR-configured balances, asset assignment and
daily activity logging, and digital exit clearance. Return receipt and ICT or
Library verification are separate asset states; exit finalization is blocked
until each assigned asset is verified, each applicable mandatory knowledge
requirement is approved, and all clearance steps are approved. HR or an
administrator can deactivate an account only after the employee's digital exit
is complete. The application enforces this at both its server action and
database finalization function. Account administration requires the private
`SUPABASE_SERVICE_ROLE_KEY`; it must never be exposed to a browser.

HR and management can review quarterly turnover reports. A Postgres scheduled
job snapshots the previous quarter's exits, leading recorded reason, average
workforce, and attrition rate at 06:00 UTC on January 1, April 1, July 1, and
October 1. The reports page also shows a live view and supports CSV export.
The commute heatmap groups recorded one-way commute distances by employee home
area.

The flight-risk dashboard uses a documented, provisional rule-based indicator:
approved leave days and request frequency in the prior 12 months, tenure
milestones within six months, and one-way commute distance. It is an early
warning prompt for HR review, not a statistically validated prediction or a
basis for employment decisions. CUT HR should validate the initial weights
and thresholds before operational use. The 35% turnaround improvement,
deployment windows, and 100% coverage targets are institutional goals to be
measured after deployment; they are not asserted as achieved by this code.

Academic Attaché and Support Staff are available as explicit account roles and
employee categories. Their self-service permissions include their own leave
and knowledge-document workflows; HR/admin-only reporting and management
capabilities remain restricted.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL

## Project structure

- app/ — application routes and dashboard pages
- components/ — reusable UI and admin panels
- lib/ — data access, auth, and server actions
- supabase/ — schema and seed migration files

## Core database model

### departments

| Column      | Type        | Notes                  |
| ----------- | ----------- | ---------------------- |
| id          | uuid        | primary key            |
| name        | text        | unique department name |
| code        | text        | short department code  |
| description | text        | optional summary       |
| created_at  | timestamptz | audit timestamp        |
| updated_at  | timestamptz | audit timestamp        |

### profiles

| Column        | Type        | Notes                |
| ------------- | ----------- | -------------------- |
| id            | uuid        | linked to auth.users |
| full_name     | text        | user display name    |
| role          | text        | assigned system role |
| department_id | uuid        | linked department    |
| created_at    | timestamptz | audit timestamp      |
| updated_at    | timestamptz | audit timestamp      |

### employees

| Column            | Type        | Notes                    |
| ----------------- | ----------- | ------------------------ |
| id                | uuid        | primary key              |
| employee_number   | text        | unique personnel number  |
| full_name         | text        | employee display name    |
| email             | text        | optional contact email   |
| job_title         | text        | role title               |
| department_id     | uuid        | department assignment    |
| employment_status | text        | active, inactive, exited |
| joined_on         | date        | onboarding date          |
| exit_date         | date        | exit date if applicable  |
| created_at        | timestamptz | audit timestamp          |
| updated_at        | timestamptz | audit timestamp          |

## Getting started

1. Install dependencies

   npm install

2. Start the development server

   npm run dev

3. Open the app in the browser

   http://localhost:3000

## Environment configuration

Create a .env.local file with the Supabase variables required by the app:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL

Daily email notifications also require a Resend account and these Supabase
Edge Function secrets:

- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL` (a verified Resend sender)

The migration `20260924_008_daily_email_notifications.sql` enables `pg_cron`
and `pg_net`, schedules the daily job for 07:00 UTC, and stores delivery state
so retries do not send duplicate digests. Before applying it, store the
following in Supabase Vault:

- `supabase_url`
- `supabase_service_role_key`

Deploy the function with `supabase functions deploy daily-notifications`, set
the Edge Function secrets with `supabase secrets set RESEND_API_KEY=... NOTIFICATION_FROM_EMAIL=...`,
store the two Vault secrets in the Supabase SQL editor, and then apply the
migrations. The scheduler runs inside Supabase, so it remains active when the
Next.js app and all user browsers are closed.

The service-role key currently present in local environment configuration must
be rotated in Supabase if it has been shared outside the project.

## Admin features

The system includes admin controls for:

- user and role management
- employee profile review
- department creation, editing, and deletion
- institutional settings and workflow defaults
- audit trail review

## Security notes

- Role checks are enforced server-side before admin-only actions.
- Department management is restricted to administrators and HR roles.
- Supabase Row Level Security and server actions are used to protect sensitive data.

## License

This project is for internal institutional use and is managed by the product owner and engineering team.

## Database reference

The project uses Supabase Postgres and includes the schema definitions under the supabase/migrations folder. These migrations define the core institutional tables, workflow controls, analytics, and demo data used by the application.

Apply `supabase/migrations/20261006_009_lifecycle_operations.sql` after the
existing migrations to add leave balances and requests, recruitment openings,
daily asset activity, employee commute and technical-staff fields, account
status enforcement, quarterly report snapshots, and the scheduled report job.

| Policy                                      | Command | Roles  | Action     | USING                                                                                                                              | WITH CHECK                              |
| ------------------------------------------- | ------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `deny_all_other_access`                     | ALL     | public | PERMISSIVE | `false`                                                                                                                            | `false`                                 |
| `managers_read_all`                         | SELECT  | public | PERMISSIVE | `(COALESCE((auth.jwt() ->> 'role'::text), 'employee'::text) = ANY (ARRAY['Administrator'::text, 'HR'::text, 'Management'::text]))` | —                                       |
| `employee_self_records`                     | SELECT  | public | PERMISSIVE | `((email = (( SELECT users.email    FROM auth.users   WHERE (users.id = auth.uid())))::text) OR (auth.uid() IS NOT NULL))`         | —                                       |
| `Employees writable by authenticated users` | INSERT  | public | PERMISSIVE | —                                                                                                                                  | `(auth.role() = 'authenticated'::text)` |
| `Employees readable by authenticated users` | SELECT  | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)`                                                                                            | —                                       |

### `exit_requests`

| Policy                                          | Command | Roles  | Action     | USING                                   | WITH CHECK                              |
| ----------------------------------------------- | ------- | ------ | ---------- | --------------------------------------- | --------------------------------------- |
| `deny_all_other_access_exit`                    | ALL     | public | PERMISSIVE | `false`                                 | `false`                                 |
| `Exit requests writable by authenticated users` | INSERT  | public | PERMISSIVE | —                                       | `(auth.role() = 'authenticated'::text)` |
| `Exit requests readable by authenticated users` | SELECT  | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | —                                       |

### `clearance_steps`

| Policy                                            | Command | Roles  | Action     | USING                                   | WITH CHECK |
| ------------------------------------------------- | ------- | ------ | ---------- | --------------------------------------- | ---------- |
| `deny_all_other_access_clearances`                | ALL     | public | PERMISSIVE | `false`                                 | `false`    |
| `Clearance steps readable by authenticated users` | SELECT  | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | —          |

### `assets`

| Policy                                   | Command | Roles  | Action     | USING                                   | WITH CHECK |
| ---------------------------------------- | ------- | ------ | ---------- | --------------------------------------- | ---------- |
| `deny_all_other_access_assets`           | ALL     | public | PERMISSIVE | `false`                                 | `false`    |
| `Assets readable by authenticated users` | SELECT  | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | —          |

### `knowledge_documents`

| Policy                                                | Command | Roles  | Action     | USING                                   | WITH CHECK |
| ----------------------------------------------------- | ------- | ------ | ---------- | --------------------------------------- | ---------- |
| `deny_all_other_access_knowledge`                     | ALL     | public | PERMISSIVE | `false`                                 | `false`    |
| `Knowledge documents readable by authenticated users` | SELECT  | public | PERMISSIVE | `(auth.role() = 'authenticated'::text)` | —          |
