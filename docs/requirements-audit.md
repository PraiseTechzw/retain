# CUT-ELAMS Requirements Audit

Prepared for the CUT-ELAMS project brief by Ruth Makanaka Shawatu.

This matrix records implementation visible in the repository. “Implemented in
code” does not mean the migrations have been applied to the live Supabase
project or that institutional outcome targets have already been achieved.
After each feature implementation, update this matrix and rerun the relevant
checks; leave deployment and outcome claims marked pending until verified.

| Brief requirement | Current status | Evidence in the application | Remaining work / acceptance check |
| --- | --- | --- | --- |
| Recruitment mapping | Implemented in code, limited | HR maps planned roles, department, category, positions, target start, and pipeline stage in `app/dashboard/recruitment/page.tsx`. | This is opening planning, not candidate tracking. Confirm this distinction matches approved scope. |
| Digital exit and clearance | Implemented in code; deployment validation pending | Clearance workflow and exit blocker checks cover approvals, assigned assets, and required knowledge handover in `app/dashboard/exit-requests/[id]/page.tsx` and the lifecycle migrations. | Apply all migrations through `20261007_011`; run role-by-role and blocked/eligible exit scenarios in Supabase. Payroll is explicitly excluded, so no salary-payment hold exists. |
| Asset return and verification | Implemented in code; target unverified | Asset receipt and verification states feed exit blockers and the return workflow. | Verify real asset inventory coverage and return reconciliation with ICT/Library. “100% visibility” is an operational target, not a code guarantee. |
| Daily asset monitoring | Implemented in code; operational coverage pending | Authorized staff can log checks, movement, maintenance, issues, and returns. The activity page now calculates unique assets with a `daily_check` today, lists unchecked assets, and offers a direct log action in `app/dashboard/assets/activity/page.tsx`. | Checks remain manual; verify that the daily queue is completed by staff and that physical asset coverage is accurate. |
| Leave self-service and balance | Implemented in code; database validation pending | Employees request leave; HR configures balances and reviews requests. Migration 011 checks year-specific weekdays against pending and approved leave and serializes checks on balance rows. | Apply migration 011; verify date ranges spanning years, exact-balance requests, over-limit requests, cancellation/rejection handling, and concurrent requests. |
| Leave turnaround reduction | Measurement available; target unverified | `app/dashboard/reports/page.tsx` calculates average elapsed time from request creation to review. | Establish a baseline, then compare after six months. A 35% improvement is not yet demonstrated. |
| Flight-risk early warning | Provisional implementation | `lib/analytics/flight-risk.ts` scores approved leave, request frequency, tenure milestones, and commute distance; the UI labels it provisional. | Validate features, weights, thresholds, bias, and outcomes with HR historical data. Do not treat as a validated prediction or employment decision. |
| Commute heatmap | Implemented in code, limited | Talent-risk page groups staff by home area and commute band. | It is a table, not a geographic map. Confirm location-data quality and access safeguards. |
| Quarterly attrition and exit drivers | Implemented in code; deployment validation pending | Quarterly view/RPC, department rates, top reason, scheduled snapshots, and CSV reporting are in the analytics/reporting migrations and reports page. | Apply migrations and validate quarter boundaries, duplicate exit records, denominator logic, reported drivers, and the scheduled job. |
| Technical knowledge handover | Implemented in code; reviewer access fix included | Mandatory applicable requirements and approved documents are checked before finalization; migration 011 aligns document review permissions with HR, Management, and configured reviewer roles and prevents self-review. | Apply migrations and test HR, Management, ICT/Library configured reviewers, document owner, and inactive-user cases. Confirm technical requirements are configured for every applicable department/category. |
| Academic Attaché and Support Staff access | Implemented in code; RLS deployment pending | Explicit roles/categories, self-service leave, and knowledge workflows are present. Migration 010/011 scopes access to active profiles and linked employee records. | Apply migrations; test both roles directly through Supabase REST/RPC, not only through hidden UI controls. |
| Role-based access and audit controls | Fixes implemented in code; live verification pending | Profile roles are the trusted role source; migration 010 installs scoped RLS; migration 011 gates inactive accounts, aligns knowledge review policies, and protects employee department and other HR-owned fields. Report activity now includes its actor. | Apply migrations 010 and 011 in order. Test anonymous, active, inactive, employee, HR, administrator, Management, ICT, Library, Attaché, and Support Staff access. |
| Payroll, student management, attendance | Out of scope | The brief explicitly excludes these capabilities. | No implementation expected unless scope is formally changed. |

## Latest Audit Fixes

- Report activity now supplies the authenticated `actor_id` required by audit
  event RLS.
- Knowledge document view/update policies use the same database reviewer rule
  as the server action, preserve uploaded content during review, and prohibit
  self-review.
- Inactive profiles are denied self-service access to protected data paths.
- Employee self-service cannot set HR-managed identity, employment, technical,
  commute, or department fields. Department is copied once from the onboarding
  profile when the employee record has no department.
- Leave entitlement checks count all existing pending/approved weekdays in a
  leave year plus only the weekdays requested in that year.

## Validation State

- `pnpm lint`: passing after the latest app changes.
- TypeScript editor diagnostics: no errors in the changed app files.
- Database migration execution: not run in this workspace; there is no local
  Supabase project configuration or PostgreSQL connection available.