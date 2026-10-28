# Deployment guide

## Before deploying

Choose a development/staging Supabase project first. Production employee data, credentials, and database schema are not configured by this repository. The local production build proves the Next.js app compiles; it does not prove that remote migrations, RLS, Storage, scheduled jobs, or email work.

Use a private server-side environment for deployment. Do not commit `.env`, `.env.local`, Supabase credentials, Resend credentials, or employee records. `NEXT_PUBLIC_` values are embedded into browser-visible code; never place a service-role/secret key in one of those variables.

## Application setup

1. Install Node.js 22 and pnpm.
2. Copy `.env.example` to `.env.local` and set the values below.
3. Install and validate:

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

4. Run locally with `pnpm dev`, or serve the production build with `pnpm start`.
5. Configure the same values in the hosting provider's server environment. Set public variables at build time, because Next.js inlines referenced `NEXT_PUBLIC_` variables into the built client bundle.

| Variable | Where used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Preferred public key. Code also accepts legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Elevated legacy key used for authorized account administration and audit writes. User listings use the signed-in user's database permissions. Store only in the secret manager; rotate the historically committed value before production. |
| `NEXT_PUBLIC_APP_URL` | Server/Edge Function links | Canonical HTTPS URL for app links and scheduled notification emails. |

Optional public branding values such as `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ORGANIZATION_NAME`, and `NEXT_PUBLIC_SUPPORT_EMAIL` are read in `lib/system.ts` and have defaults.

## Database migration rollout

SQL migration files are under `supabase/migrations/` and now use unique 14-digit Supabase CLI version prefixes. The latest migrations add defense-in-depth controls:

- `20261028000100_reconcile_employee_columns.sql` repairs missing employee fields in older or partially provisioned databases, including `phone`, `employment_category`, and `user_id`.
- `20261028000200_remove_unvalidated_retention_scores.sql` removes the unsupported score column while preserving support-intervention records.
- `20261011000000_security_leave_integrity.sql` removes stale permissive RLS policies, installs trusted profile creation, prevents overlapping leave and duplicate daily checks, and revokes internal RPC access.
- `20261011000100_daily_digest_idempotency.sql` prevents duplicate in-app daily digests per user and date.
- `20261011000200_exit_clearance_atomicity.sql` snapshots clearance requirements, repairs duplicate clearance steps, enforces one normalized department step per exit, provisions steps transactionally, blocks missing steps, and restricts finalization. It is safe to rerun after a failed transactional attempt; reconcile migration history before using the CLI on an existing project.
- `20261011000300_audit_integrity.sql` removes direct authenticated inserts into the audit log.
- `20261011000400_canonical_profile_roles.sql` normalizes profile roles to the supported canonical values and downgrades unknown labels to Employee.

Deploy the application version that no longer reads or writes `risk_score` before applying `20261028000200_remove_unvalidated_retention_scores.sql`. Applying the column-drop migration while an older application version is still serving traffic will cause old support-action writes to fail.

The older repository used nonstandard date-plus-ordinal names, including duplicate ordinals. Renaming migration files changes their local version IDs, not their SQL contents; it does **not** rewrite any existing remote migration history or prove which SQL has already run.

Before using the Supabase CLI on any existing project:

1. Confirm the correct staging project and that a current, restorable database backup exists.
2. Install the Supabase CLI and link the intended project using the organization's approved account.
3. Run `supabase migration list` and compare the remote migration history with the new local directory. The older filenames may have been applied manually or recorded under different versions. Stop if the remote schema has manually applied changes or history diverges; do not use `migration repair` to guess at the state.
4. Review every pending SQL migration, including RLS policies, `SECURITY DEFINER` functions, grants, triggers, and scheduled jobs. Test the complete chain on a disposable local/staging database. The integrity migrations deliberately stop if pre-existing duplicate daily checks or duplicate daily-digest notifications need cleanup.
5. Before role normalization, export and verify the Administrator/HR account roster against CUT's authoritative list. Unknown or unsupported role labels are changed to Employee; previously copied canonical privileged values still require owner verification.
6. Inspect existing exit requests before applying the clearance snapshot migration. It backfills current clearance defaults to open exits and creates any missing pending steps; confirm this is the intended treatment for the target database.
7. Apply only after the database owner approves the rollout. Never apply this migration set to production from an unreviewed workstation.
8. After applying to staging, run the role-by-role acceptance scenarios in [Operations](operations.md) before considering production.

The repository has no checked-in `supabase/config.toml` or local database test harness. Migration execution and live RLS validation are not claimed as completed here. Keep environment-specific project references out of source files.

## Knowledge-document Storage

Migrations `20261028000300_configure_knowledge_document_storage.sql` and `20261028000400_knowledge_document_storage_policies.sql` configure the private `knowledge-documents` bucket with a 10 MiB limit, the PDF/Word/Excel/PowerPoint MIME types accepted by the app, and Storage RLS policies. Apply both to the affected Supabase project: missing MIME configuration can reject uploads, and missing object policies produce `new row violates row-level security policy for table "objects"`. Uploads are restricted to active HR/admin users and an employee's own record; object reads follow the authorization on the associated `knowledge_documents` row. The upload action validates the extension and MIME type, employee and applicable requirement, writes the object under a private employee path, and creates a database row. This is not malware scanning. Download uses a signed URL that expires after five minutes. If the database insert fails after an upload, the app attempts to remove the orphaned object.

Before go-live, verify that the bucket exists, is private, has suitable size/MIME restrictions, and has policies consistent with the server action and database authorization model. Test owner upload, reviewer read/review, cross-employee denial, and inactive-user denial directly against the staging project.

## Scheduled daily notifications

The daily digest requires the database migration, Supabase Edge Function, Supabase Vault, and Resend configuration.

1. Deploy `supabase/functions/daily-notifications` using the Supabase CLI.
2. Set Edge Function secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, and `NEXT_PUBLIC_APP_URL` (the function falls back to the Supabase URL only if the app URL is absent).
3. Store `supabase_url` and `supabase_service_role_key` in Supabase Vault for the scheduled database invocation.
4. Ensure the migration-created `pg_cron`/`pg_net` job is present and scheduled for 07:00 UTC.
5. Set `notification_channel` to `email`, `in_app`, or `both`. For email modes, verify the Resend sender and recipient email addresses.
6. Test against staging with a deliberately outstanding asset check. Confirm the selected channel(s), in-app popover and read state, daily idempotency, delivery-log behavior, failure logging, and no-outstanding-work case.

Do not run a test digest against real employees without the project owner's approval. Never paste live key values into issues, logs, or documentation.

## Quarterly report schedule

Migration `009` installs the prior-quarter snapshot function and a `pg_cron` job at 06:00 UTC on January 1, April 1, July 1, and October 1. Validate the function's quarter boundaries, exit reason mapping, average-workforce denominator, duplicate handling, and the report page's live-versus-snapshot behavior on staging.

## Production acceptance gate

Production readiness requires all of the following: reviewed and reconciled migrations; RLS tests for each role and inactive accounts; private Storage policy tests; at least one end-to-end leave and exit test; verified notification and quarterly schedules; HTTPS and production environment variables; a rotated service-role credential; backups and an incident owner; and HR approval of the analytics interpretation. Payroll processing and salary-release control are not provided by this app.
