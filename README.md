# Retain

Retain is a continuity and workforce operations platform for institutions that need secure employee records, department management, knowledge retention, and structured clearance workflows.

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
