# Operations and acceptance runbook

This runbook is for CUT HR, ICT/Library custodians, and the technical project owner. Confirm local institutional procedures before using the system with employee records.

## Daily operations

### HR and Management

- Review exit requests, configured clearance steps, leave decisions, and the daily digest.
- For each exit, use the blocker list to coordinate approvals, asset receipt/verification, and required knowledge handover. Required steps are captured when the request is submitted and cannot be changed afterward.
- Finalize only when the database reports every check complete. Treat account deactivation as a separate action and retain its audit record.
- HR can manage permitted account status and workflow operations but cannot change assigned roles or activate/deactivate Administrator/HR accounts. Only an Administrator can change roles or manage Administrator/HR account status.
- Use the Talent Retention & Support page to record employee-agreed support actions and follow-up dates. The page does not predict attrition or rank employees.
- Check missing technical-knowledge requirements before an exit; configure department/category requirements in advance.

### ICT and Library

- Keep asset tags and assignment records accurate.
- Record daily checks, movements, maintenance, issues, and returns as they occur. Daily checks apply only to assigned assets and today's UTC date; a duplicate asset/day check is rejected.
- For exit returns, record receipt and complete verification. A log is an audit event, not independent proof that physical inspection occurred.
- Investigate digest asset tags with no daily check for the current date.

### Employees

- Keep profile/onboarding information current. Profile roles are assigned by an Administrator; users cannot recreate a missing or inactive profile themselves.
- Submit leave through self-service, monitor status, and cancel only a still-pending request when needed.
- Upload requested knowledge handover documents to the applicable requirement before an exit. The upload form accepts PDF, Word, Excel, and PowerPoint under 10 MB; this is not malware scanning.

## Scheduled jobs and monitoring

| Job | Schedule | What to verify |
| --- | --- | --- |
| Daily operations digest | 07:00 UTC daily | Edge Function invocation, counts, selected channel, Resend response when enabled, per-recipient email log, and in-app notices. |
| Quarterly turnover snapshot | 06:00 UTC on Jan 1, Apr 1, Jul 1, Oct 1 | Snapshot for the immediately previous quarter, department rows, counts, reason, denominator, and generated timestamp. |

These jobs run inside Supabase, not inside a browser or the Next.js process. Check Supabase `pg_cron`/`pg_net` job history and Edge Function logs. Check Resend delivery events for email acceptance. A Next.js deployment alone does not configure these jobs.

## Acceptance scenarios

Run these only in a staging project with synthetic users and records. Use direct Supabase REST/RPC checks as well as the UI so hidden buttons are not mistaken for authorization. Apply/reconcile the local migration history before running tests.

### Authentication, roles, and audit

- Test anonymous, active, inactive, missing-profile, and newly registered accounts. New signup should receive an Employee profile from the database trigger; a missing profile must not be recreatable by the same user.
- For each role—Administrator, HR, Management, ICT, Library, Employee, Academic Attaché, and Support Staff—verify allowed and denied reads/writes. Confirm Attaché/Support Staff can access only their own self-service records.
- Attempt self-promotion through Auth metadata, profile REST updates, and server actions. Confirm only Administrator role assignment succeeds; HR cannot promote users or change status of Administrator/HR accounts.
- Confirm obsolete broad employee/department/quarterly-report policies are absent. Attempt cross-employee reads/writes and direct audit-event inserts.
- Attempt direct table completion of an exit and changes to its clearance snapshot/finalization fields; these must fail.

### Leave

Test a request within balance, exactly at balance, over balance, date spans crossing years, weekday/weekend boundaries, overlapping pending/approved requests, and two simultaneous overlapping requests. Test a non-overlapping request with the same remaining balance. Confirm employees can cancel their own pending request only, cannot cancel an approved/rejected request, and cannot alter request dates/details/status directly. Confirm reviewers cannot review their own request or change the underlying request details.

### Exit and handover

- Submit a request with configured departments. Verify the database stores an immutable department snapshot and creates every step atomically. Force a step-provisioning error in a disposable test database and confirm the exit insert also rolls back.
- Change the default configuration after submission and confirm the existing exit retains its original snapshot.
- Test a deliberately missing required step, pending/rejected clearance, asset not received, asset received but not verified, missing mandatory requirement, rejected/revision-required document, technical employee with no approved handover, and technical employee with no applicable requirements configured. Every case must block finalization.
- Approve all blockers and confirm finalization succeeds once for an open request. Confirm a second call, rejected/cancelled/draft request, or direct `status='completed'` update is rejected.
- Confirm account deactivation is denied before a completed digital exit and allowed only to an authorized account manager afterward. Confirm payroll release remains outside this application.

### Assets, reminders, and reports

Test an assigned asset with a daily check, without a check, an unassigned asset, a past/future date, and duplicate same-day checks. Verify reminder roles, all three channel values (`email`, `in_app`, `both`), unread/read behavior, email failure logging, idempotency, asset-tag handling, direct activity link, and no-outstanding-work case. Test quarterly boundaries around all four schedule dates and compare report calculations with a separately reviewed sample.

### Analytics and privacy

Verify commute distance is one-way, home areas are generalized, small matrix groups are suppressed, and reporting access is limited. Do not use commute or service dates as a proxy for employee attrition. Establish operational baselines before claiming any adoption or turnaround target.

## Incident response

If a credential is exposed, disable/rotate it in the relevant provider immediately, update the secret manager, and review provider access logs. Removing a credential from the current branch does not remove it from Git history. If the leaked credential was committed, rotate it first; coordinate any history rewrite separately with repository collaborators.

For a failed migration or incorrect policy, pause rollout and preserve logs. Do not run `supabase migration repair` or manually change production schema without confirming current schema and migration history with the database owner. The recent migration filenames were normalized; compare remote history carefully before applying them.

For email failures, inspect Edge Function logs, Resend responses, recipient profiles/Auth emails, `notification_delivery_log`, and Vault/Function secret names. Never log or share secret values.
