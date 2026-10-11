# Security model and review checklist

CUT-ELAMS handles identifiable employee information, leave records, work histories, home-area/commute data, exit details, and private handover documents. Treat all of these as confidential institutional data. This document describes safeguards in source and pending migrations; it is not a substitute for CUT policy, a penetration test, or live Supabase verification.

## Authorization layers

- **Session:** Supabase Auth identifies the user. The Next.js proxy validates the session, refreshes cookies, and rejects unauthenticated or inactive profiles on protected paths.
- **Profile initialization:** the latest migrations create profiles from a trusted Auth-user trigger with the least-privileged `Employee` role and normalize roles to the supported canonical set. User-controlled metadata cannot assign a role. Client self-insert policies are removed; the proxy, sign-in, pages, and actions fail closed if an account has no active profile.
- **Application:** server actions validate the authenticated actor and exact canonical `profiles.role` values. Only an exact Administrator can change user roles. HR cannot deactivate or reactivate Administrator/HR accounts. Hiding a navigation item is not authorization.
- **Database:** RLS scopes employee-owned and role-specific reads/writes. The hardening migrations remove older permissive employee, department, quarterly-report, and self-profile policies that would otherwise be ORed with newer restrictive policies. Triggers protect leave decisions, clearance snapshots, and exit finalization.
- **Privileged administration:** `SUPABASE_SERVICE_ROLE_KEY` is server-only. It is used for authorized system-user listing, account administration, and server-side audit writes after application authorization; it bypasses RLS and must never reach browser code or source control.
- **Documents:** uploads are limited to PDF, Word, Excel, and PowerPoint files under 10 MB, with a matching extension/MIME type. Files are stored in a private bucket and downloaded through short-lived signed URLs. These checks are not malware scanning; verify Storage policies and add institutional malware scanning if required.

The `NEXT_PUBLIC_` prefix makes referenced values available to browser code at build time. Only the Supabase URL and publishable/legacy anon key belong there. The service-role credential must remain server-only. A key committed in the past should be rotated at the provider; deleting the latest file does not revoke historical credentials.

## Database invariants

- Leave requests cannot overlap another pending or approved request for the same employee; employee-scoped transaction locking prevents concurrent requests from bypassing the check. Employees can cancel only their own pending requests. Reviewers cannot rewrite request details or review their own request.
- A daily asset check is limited to a currently assigned asset and today's UTC date. A partial unique index allows at most one `daily_check` per asset/day.
- Each exit request stores an immutable snapshot of required clearance departments. A database trigger provisions all steps in the same transaction as the request. Missing steps, pending approvals, outstanding assigned assets, or missing required knowledge block the `finalize_exit` RPC. Direct table updates cannot mark an exit complete or rewrite its finalization fields.
- Authenticated users cannot insert audit events directly. Server actions write them through the server-only client; the `finalize_exit` security-definer function writes its own audit records.
- Direct execution of internal `SECURITY DEFINER` helpers such as `create_notification`, `set_system_setting`, and `can_finalize_exit` is revoked. The authenticated finalization RPC independently checks the active HR/Administrator profile and actor identity.

## Role and data minimization

Roles include Administrator, HR, Management, ICT, Library, Employee, Academic Attaché, and Support Staff. Role data comes only from `profiles`; user metadata and UI role normalization are not authorization sources. Migration `20261011000400_canonical_profile_roles.sql` downgrades unknown labels to Employee, but existing canonical Administrator/HR values must still be checked against CUT's authoritative roster before deployment because a prior migration copied metadata values into profiles.

- employees, Attachés, and Support Staff should reach only their own self-service data;
- HR/admin access to identifiable employee and exit information should follow institutional policy;
- commute area/distance should be collected at the minimum precision needed and restricted to authorized HR/management users; small heatmap groups are suppressed in the UI;
- flight-risk scores are provisional, explainable indicators for human follow-up, not validated predictions or automated employment decisions;
- knowledge-document files need ownership, reviewer-role, and no-self-review checks.

The application has no separate University Council role. Do not infer that every Management account or Council member should see person-level analytics; define an approved read-only and minimized view before adding Council access.

## Release security checks

1. Review pending SQL, RLS policies, grants, `SECURITY DEFINER` functions, triggers, and Storage policies.
2. Test anonymous, active, inactive, Employee, HR, Administrator, Management, ICT, Library, Attaché, and Support Staff access directly against staging.
3. Confirm the obsolete broad employee/department/quarterly policies are absent; attempt cross-employee reads/writes, self-profile recreation, self-promotion via metadata/substring role labels, HR promotion, HR changes to HR/Admin accounts, and direct audit-event insertion.
4. Attempt overlapping and concurrent leave requests, unauthorized leave-field/status changes, duplicate daily checks, and a direct `exit_requests.status = 'completed'` update.
5. Test required-but-missing clearance steps, asset receipt/verification, required knowledge, reviewer self-review, and inactive-user access.
6. Confirm service-role access exists only in server code/Edge Functions after authorization checks; verify logs contain no keys, tokens, document contents, or unnecessary identifiers.
7. Rotate credentials that were committed or otherwise shared, review provider access logs, and verify private Storage access and signed-URL expiry.

The SQL files are not reported as applied to a live database. Review and reconcile the migration history before running them in staging or production; see [Deployment](deployment.md).

## Reporting vulnerabilities

Do not submit credentials, employee records, or exploitable details in a public GitHub issue. Follow the repository's [security reporting policy](../SECURITY.md). GitHub supports private vulnerability reports only when the repository owner enables that feature. If it is unavailable, use the organization's approved private security contact.

## References

- [Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
