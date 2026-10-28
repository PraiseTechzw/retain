# CUT-ELAMS Requirements Audit

Prepared for the CUT-ELAMS project brief supplied by the product owner.

This matrix records implementation visible in the repository. **“Implemented in code” does not mean the SQL migrations have been applied to the institution's database, the deployed application is live, or an operational target has been achieved.** All live authorization, data, schedule, and email behavior remains subject to staging acceptance.

| Brief requirement | Current status | Evidence in the application | Remaining work / acceptance check |
| --- | --- | --- | --- |
| Recruitment and employee records | Implemented in code, limited | HR/Admin employee create/edit workflows and planned opening management in `app/dashboard/employees`, `app/dashboard/recruitment`, and `lib/supabase/actions.ts`. Openings capture role, department, category, positions, target start, and stage. | This is opening planning, not a candidate application pipeline. Confirm that distinction matches the approved scope. |
| Digital exit and clearance | Implemented in code; migration and staging validation pending | Exit requests snapshot configured departments; database triggers provision clearance steps atomically. Missing steps, pending approvals, assigned assets, and required knowledge block the finalization RPC. Finalization is a separate, authorized workflow from account deactivation. | Reconcile the renamed migration history, apply to staging, and test partial/failed creation, immutable snapshots, all blockers, direct-update denial, and repeated/terminal finalization. Payroll is not integrated. |
| Asset return and verification | Implemented in code; target unverified | Asset receipt, return, verification, and status feed exit blockers and the return workflow. | Verify real inventory coverage and return reconciliation with ICT/Library. “100% visibility” is an operational target, not a code guarantee. |
| Daily asset monitoring | Implemented in code; external schedule/delivery validation pending | Authorized staff log checks, movement, maintenance, issues, and returns. Checks are limited to assigned assets/current UTC date, and a partial unique index prevents duplicate asset/day checks. The scheduled digest supports email, in-app, or both. | Apply migrations; configure `pg_cron`/`pg_net`, Edge Function secrets, Resend for email modes, and the app URL. Test each channel, failures, unread/read behavior, idempotency, and physical coverage. |
| Leave self-service and balance | Implemented in code; database validation pending | Employees request leave; HR configures balances and reviews requests. Server and database checks count pending/approved requests, prevent overlapping requests, serialize balance checks, and allow employees to cancel their own pending requests. | Apply migrations and test year boundaries, weekends, exact/over balance, concurrent and overlapping requests, cancellation, direct unauthorized updates, and reviewer self-review. |
| Leave turnaround reduction | Measurement available; target unverified | Reports calculate elapsed time from request creation to review. | Establish a measured baseline and compare after the agreed period. A 35% improvement is not demonstrated by source code. |
| Flight-risk early warning | Not implemented as a prediction | The former unvalidated score was removed. `app/dashboard/talent-risk/page.tsx` now presents neutral commute/service-date context and HR-recorded support actions without scoring or ranking employees. | A future prediction requires approved institutional outcome data, validation, fairness and privacy review, and governance before implementation. |
| Commute heatmap | Implemented in code, privacy-limited | Talent-risk page groups home areas and one-way commute bands, normalizes area labels, uses a heat scale, and suppresses small groups. Inputs request only broad locality labels. | It is a table/matrix, not a geographic map. Validate access, data minimization, and re-identification risk in staging. |
| Quarterly attrition and exit drivers | Implemented in code; deployment validation pending | Quarterly view/RPC, department rates, top reason, scheduled snapshots, and summary CSV reporting are present. Page refreshes no longer create false report-generation audit events. | Apply migrations and validate quarter boundaries, denominator/duplicate-exit rules, report access, and scheduled snapshots. |
| Technical knowledge handover | Implemented in code; environment validation pending | Private Storage, scoped reviewer roles, no-self-review checks, requirement matching, and exit blockers exist. Uploads are limited to PDF/Office document formats under 10 MB with matching extension/MIME. | Apply migrations; test owner/reviewer/inactive-user permissions, signed-link expiry, and all technical requirements. The upload checks are not malware scanning. |
| Attaché and Support Staff access | Implemented in code; RLS deployment pending | Explicit roles/categories and self-service leave/knowledge flows are present. New hardening removes self-profile insertion and fails closed when a profile is missing/inactive. | Test both roles directly against Supabase REST/RPC, not only through UI visibility. |
| Role-based access and audit controls | Hardened in code/migrations; live verification pending | Exact canonical profile roles drive server-action authorization; only an exact Administrator may change roles. HR cannot change roles or administer Administrator/HR account status. Missing/inactive profiles fail closed at the proxy, page context, sign-in, and actions. Latest migrations remove stale permissive RLS policies, restrict direct audit inserts, create profiles with Employee, normalize unsupported legacy role labels, and revoke internal RPC execution. | Reconcile/apply migrations. Verify the existing Administrator/HR roster against CUT's authoritative list before role normalization. Test every role against REST/RPC, especially legacy-policy removal, self-promotion, direct audit insertion, and the service-role boundary. |
| Payroll, student management, attendance | Out of scope / unresolved payroll boundary | The repository has no payroll integration, student-management module, attendance system, or salary-payment instruction. | Confirm whether the brief's requested final-salary hold is an external dependency. Any payroll integration needs separate ownership, authorization, data-flow, and approval. |
| University Council reporting | Not implemented as a distinct role | No separate Council role or Council-specific dashboard is present. | Decide whether Council should receive a new read-only, privacy-minimized reporting role; do not equate Council with general Management access without approval. |

## Latest implementation work

- Standardized existing migration filenames to unique 14-digit Supabase CLI versions. File renaming does not reconcile a database that recorded earlier names or applied SQL manually.
- Added migration `20261011000000_security_leave_integrity.sql` for stale permissive policies, trusted profile creation, leave integrity, daily-check uniqueness, and restricted RPC execution.
- Added `20261011000100_daily_digest_idempotency.sql`, `20261011000200_exit_clearance_atomicity.sql`, and `20261011000300_audit_integrity.sql` for daily digest uniqueness, atomic exit clearance and finalization guards, and audit-log insertion integrity.
- Added `20261011000400_canonical_profile_roles.sql` to downgrade unsupported legacy labels to Employee; canonical privileged profile values still need to be checked against the institution's authorized roster.
- Made application authorization compare exact canonical profile roles, removed role assignment from user-controlled Auth metadata, and made missing/inactive profiles fail closed.
- Made account role changes Administrator-only and prevented HR from changing Administrator/HR account status.
- Replaced the static notification bell with a user-scoped in-app notification center and made the digest honor `email`, `in_app`, and `both` settings.
- Tightened knowledge uploads to supported formats/size, replaced the unvalidated flight-risk score with an HR support workflow, added CSV export, removed page-refresh audit side effects, and expanded the employee lifecycle workflow.

## Validation state

- `pnpm lint`: passed without warnings.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; all listed application routes compiled.
- Deno Edge Function checks passed in the previous validation. The retention-support unit checks were updated when the unvalidated score was removed; they were not run during this change.
- PostgreSQL statement-grammar parsing: all 18 migration files parsed; every version is a unique 14-digit prefix. Parsing is not SQL execution or PL/pgSQL runtime validation.
- Markdown local links passed; all 4 Mermaid diagrams in the README/system overview rendered successfully.
- `git diff --check`: passed after the final code and documentation edits.
- SQL execution, migration history reconciliation, RLS/Storage acceptance, scheduled jobs, email delivery, and production verification: **not run**. No database migrations were applied by this workspace session.

## Product-owner decisions to close

1. Confirm whether recruitment means planned openings only or full candidate application tracking.
2. Confirm whether payroll must consume an exit-finalization signal before final salary, and identify the system owner.
3. Decide whether University Council needs a separate read-only, minimized reporting role.
4. Verify the current Administrator/HR list against CUT's authoritative roster before applying the role-canonicalization migration.
5. Identify the authorized staging project and migration owner; reconcile the historical migration IDs before any deployment.
