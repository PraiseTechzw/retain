# CUT-HRMERS implementation TODO

This is the implementation backlog for the agreed **CUT Human Resource Management and Employee Retention System (CUT-HRMERS)**. It is the source-of-truth plan alongside [the agreed scope](./cut-hrmers-agreed-scope.md).

## Product decisions already agreed

- CUT-HRMERS is an HR-only, day-to-day Human Resource Management System.
- The agreed roles are Administrator, HR, HR Manager, and Employee. Confidential Case Officer is a separately assigned permission for HR and HR Managers; it does not grant Administrators access to confidential content.
- Retention, engagement, and exit analytics are built into the HRMS; exit clearance and asset management are not the purpose of the product.
- Employees use self-service features. HR manages all HR workflows. Administrators manage access and system configuration.
- Payroll calculation, external integrations, and any feature requiring CUT policy approval remain out of scope until validated.

## Approved SMART objectives

1. Capture and centralise academic and non-academic employee records and initial data within **one month**.
2. Deploy employee self-service for leave applications and HR requests within **three months**.
3. Implement contracts, probation, onboarding, and disciplinary-case workflows within **six months**.
4. Automate engagement tracking, exit management, and quarterly turnover reporting within **nine months**.

## Current project baseline

| Area | Current state | Required direction |
| --- | --- | --- |
| Authentication, profiles, employee records, departments, notifications, and audit events | Present | Retain, strengthen, and align to HR-only roles. |
| Leave requests and balances | Present | Complete the rules, approvals, balances, and employee self-service experience. |
| Exit requests and reporting | Present, but coupled to asset, knowledge, and departmental clearance blockers | Replace with a self-contained HR exit case and exit interview workflow. |
| Retention interventions and turnover reporting | Present in early form | Build into a complete engagement, retention, and insight workflow. |
| Recruitment, assets, knowledge hub, clearance, and asset activity | Present | Do not expose as core CUT-HRMERS functions. Preserve existing data until an approved retirement/migration decision. |

## Completed transition work

- [x] Legacy CUT-ELAMS screens and navigation removed from the active application.
- [x] Legacy migration history replaced with a fresh CUT-HRMERS baseline schema.
- [x] HRMS RLS policy migration and development reference seed added.
- [x] HR dashboard refocused on employees, leave, and HR exit cases.
- [x] New employee capture form and HR exit-case creation form aligned to the new schema.

## Definition of done

The system is ready for CUT HR when an employee can securely submit a request or leave application; HR can process routine staff work from one dashboard; HR can manage appointments, contracts, cases, engagement, and exits; and authorised HR leaders can view trustworthy workforce and retention trends.

---

## Phase 0 — Requirements, governance, and safe transition

- [ ] Hold a requirements workshop with CUT HR, HR management, ICT/security, and an authorised data-protection representative.
- [ ] Confirm the official system name, project owner, and operational sponsor.
- [ ] Map CUT's current paper, spreadsheet, and existing-system workflows.
- [ ] Confirm academic/non-academic staff categories, faculties, departments, grades, employment types, and employment statuses.
- [ ] Confirm leave types, leave balance rules, supporting-document rules, and approval procedures.
- [ ] Confirm contract, appointment, probation, confirmation, and renewal rules.
- [ ] Confirm which employment letters and HR requests employees may make online.
- [ ] Confirm who may access confidential grievances, disciplinary matters, exit interviews, survey responses, and reports.
- [ ] Confirm data-retention, archive, deletion, export, and backup requirements.
- [ ] Confirm whether staff accounts use CUT email, employee number, single sign-on, or administrator-created credentials.
- [ ] Confirm payroll and existing-system boundaries; do not duplicate an approved external system without a defined integration need.
- [ ] Define a data-migration plan and data-quality checks for existing staff records.
- [x] Rename visible branding and documentation from CUT-ELAMS to CUT-HRMERS.
- [ ] Create a safe retirement plan for asset/clearance features: hide them first, migrate or archive data only after written approval.

**Acceptance:** CUT HR signs off the process maps, role matrix, data fields, and feature boundaries.

## Phase 1 — Foundation, roles, and HR dashboard

### Security and account management

- [x] Keep the agreed Administrator, HR, HR Manager, and Employee roles; add Confidential Case Officer as a separately assigned permission for HR and HR Managers.
- [ ] Ensure employees can read and edit only permitted parts of their own profile and requests.
- [ ] Ensure HR Staff can access only records permitted by their HR level.
- [x] Ensure Administrators cannot automatically view confidential HR case or survey content.
- [x] Require administrator-created or approved staff accounts; disable unrestricted public registration.
- [ ] Add account activation, deactivation, password reset, and employee-account-to-staff-record matching.
- [ ] Keep immutable audit events for sensitive HR actions.
- [ ] Review and test Supabase row-level security for every new and existing HR table.

### HR dashboard

- [x] Redesign the dashboard as an HR control centre rather than an asset/clearance summary.
- [ ] Add a "Due today" queue for requests, leave approvals, contract expiries, probation reviews, case deadlines, engagement actions, and exit cases.
- [ ] Add an employee-facing dashboard showing personal profile, requests, leave, documents, and tasks only.
- [ ] Add HR dashboard totals for active staff, staff on leave, contracts expiring, open cases, open exits, and overdue actions.
- [ ] Add direct links from every dashboard task to the actual record requiring action.
- [x] Remove asset, clearance, knowledge hub, and other non-HR links from the primary navigation.
- [ ] Add empty states and clear guidance for new HR users.

**Acceptance:** Each user sees only their authorised navigation and can complete their daily work from the dashboard.

## Phase 2 — Employee register and employee self-service

### Employee register

- [ ] Define and add required employee fields: employee number, legal/preferred name, CUT email, faculty/department, position, grade, staff category, employment type, appointment date, contract dates, probation dates, status, location/campus, and manager where approved.
- [ ] Add employee employment-history records so changes to role, department, grade, or employment type are preserved.
- [ ] Add secure HR document metadata and storage for appointment letters, contracts, and approved personnel documents.
- [ ] Add employee profile validation, duplicate employee-number prevention, and complete data-quality checks.
- [ ] Add safe employee activation, transfer, status change, and archive flows.

### Employee self-service

- [ ] Create a "My Profile" page with a clear separation between editable and HR-controlled fields.
- [ ] Allow employees to submit profile-correction requests rather than edit protected employment fields directly.
- [x] Create an HR request centre for employment letters, document requests, and general HR questions.
- [x] Add request categories, status, assignment, and resolution tracking. Attachments, priority, and closure reasons remain pending.
- [x] Let employees track only their own requests through row-level security.
- [x] Let HR assign, respond to, resolve, and audit requests.

**Acceptance:** HR maintains accurate staff records; employees can securely request common HR services without informal paper or email-only tracking.

## Phase 3 — Contracts, appointments, onboarding, and probation

- [ ] Create appointment and contract records linked to an employee.
- [ ] Store employment type, effective date, end date, renewal status, and authorised contract document.
- [ ] Add contract-expiry reminders at CUT-approved intervals.
- [ ] Create an HR review workflow for renewal, extension, conversion, or expiry outcomes.
- [ ] Create onboarding tasks for a new employee and record completion dates.
- [ ] Create 30-day, 90-day, and CUT-approved probation or confirmation milestones.
- [ ] Notify the responsible HR user when a milestone is due or overdue.
- [ ] Preserve history when a contract or appointment changes; do not overwrite the old record.

**Acceptance:** HR can identify all contracts and reviews due in the selected period and has a complete appointment history for each employee.

## Phase 4 — Leave and absence management

- [ ] Confirm leave policies before coding calculations.
- [ ] Define leave types, eligibility, annual allocations, carry-over, evidence requirements, and approval chains.
- [ ] Redesign employee leave application flow with date validation, balance preview, reason, attachment, and submission confirmation.
- [ ] Give HR a leave queue with approve, reject, return-for-information, cancel, and comment actions.
- [ ] Add approved absence calendar and upcoming-leave view for authorised HR users.
- [ ] Add leave-balance administration with reason, audit trail, and controlled HR access.
- [ ] Add absence-pattern reporting only where policy and privacy rules allow it.
- [ ] Add notifications for submission, action, cancellation, and return-to-work requirements.

**Acceptance:** Employees can submit and track leave; HR can apply CUT-approved rules and report accurate balances and approved absences.

## Phase 5 — Employee relations and confidential HR case management

- [ ] Define permitted case types: grievance, workplace concern, disciplinary matter, welfare/support concern, and other approved categories.
- [ ] Create a restricted case record with reporter, subject employee, classification, priority, owner, due date, status, and outcome.
- [ ] Add role-based case access; confidential cases must be visible only to specifically authorised HR users.
- [ ] Add chronological case notes, secure attachments, follow-up tasks, reminders, and an outcome/closure process.
- [ ] Add a confidential employee concern submission path if CUT approves anonymous or named reporting.
- [ ] Record access to sensitive case records in the audit trail.
- [ ] Define case archival and retention rules with CUT policy owners.

**Acceptance:** HR can manage a confidential case end-to-end without exposing sensitive information to unauthorised administrators or employees.

## Phase 6 — Engagement and retention

- [ ] Define approved check-in and survey questions with CUT HR; avoid collecting unnecessary sensitive information.
- [ ] Create HR-managed survey templates, schedules, target groups, opening/closing dates, and response rules.
- [ ] Create employee check-ins at approved milestones such as 30 days, 90 days, six months, and annually.
- [ ] Enable employees to submit feedback confidentially according to approved privacy rules.
- [ ] Create a retention concern record that groups recurring issues without automatically labelling an employee as "high risk".
- [ ] Create retention actions with an owner, action date, due date, target group, status, and outcome.
- [ ] Add a dashboard for response rates, themes, unresolved actions, and trend comparisons.
- [ ] Publish only aggregated survey insights where response anonymity is required.

**Acceptance:** HR can collect staff feedback, follow up on concerns, and measure whether retention actions are completed and helpful.

## Phase 7 — HR exit management

- [ ] Replace departmental clearance/asset blockers with an internal HR exit checklist.
- [ ] Define exit types: resignation, retirement, end of contract, termination, death in service, and approved transfer or other CUT-defined outcomes.
- [ ] Allow an employee to submit a resignation/notice and attach a resignation letter.
- [ ] Allow HR to create an exit case for HR-initiated events, including contract expiry, retirement, or termination.
- [ ] Capture notice date, last working day, exit type, voluntary/involuntary status, primary reason, secondary reasons, and authorised HR notes.
- [ ] Create an exit interview questionnaire with confidential responses and an optional "would return" response where approved.
- [ ] Add an HR-only checklist: exit interview, required personnel documents, final HR review, employee status update, and case closure.
- [ ] Notify employees and assigned HR users about exit-case updates according to policy.
- [ ] Change an employee to Exited only through the authorised HR exit-completion action.
- [ ] Archive the exit case and related documents according to retention rules.
- [ ] Preserve historical exits for approved workforce analytics.

**Acceptance:** HR can manage voluntary and HR-initiated exits without assets, departmental clearance, or other departmental logins.

## Phase 8 — Reporting, workforce trends, and retention insight

- [ ] Define reporting permissions; workforce reports are HR-only.
- [ ] Create operational reports for staff register completeness, leave requests, leave balances, contract expiries, probation milestones, requests, and HR cases.
- [ ] Create workforce reports for headcount by staff category, faculty/department, position, employment type, and status.
- [ ] Create exit reports by period, exit type, voluntary/involuntary status, primary reason, department, staff category, employment type, and tenure.
- [ ] Calculate turnover rates only after HR approves the formula and headcount denominator.
- [ ] Add month, quarter, year, and two-year comparison filters when historical data exists.
- [ ] Add engagement and retention reports: response rates, aggregate themes, open actions, and action outcomes.
- [ ] Add secure CSV/PDF export with permission checks and audit logging.
- [ ] Add data-quality warnings whenever a trend is based on incomplete, small, or confidential data.

**Acceptance:** HR management can answer workforce and retention questions with traceable data, not manual spreadsheet work.

## Phase 9 — Data, quality assurance, deployment, and adoption

- [ ] Create versioned Supabase migrations for every schema change; never modify applied migrations.
- [ ] Add seed/demo data covering academic and non-academic staff, employee requests, leave, contracts, cases, surveys, retention actions, and exits.
- [ ] Write unit and integration tests for all calculations, permissions, confidential records, lifecycle transitions, and notifications.
- [ ] Test each role's end-to-end journey: Administrator, HR Officer, HR Manager, Confidential Case Officer, Academic Employee, and Non-academic Employee.
- [ ] Run security review of authentication, storage, signed downloads, server actions, and row-level security.
- [ ] Test mobile and accessibility behaviour for employee self-service.
- [ ] Create a data-import template and import validation report for existing CUT records.
- [ ] Produce HR user guides, administrator guide, employee quick-start guide, and support procedure.
- [ ] Pilot with a small authorised CUT HR group and a representative staff group.
- [ ] Record pilot feedback, fix critical issues, and obtain formal go-live approval.
- [ ] Establish backups, incident handling, monitoring, and a post-launch support owner.

**Acceptance:** The system is secure, tested, documented, piloted, and approved for controlled CUT deployment.

## Deferred unless explicitly approved

- [ ] Payroll calculation or payroll disbursement.
- [ ] Automatic recruitment or applicant-tracking replacement for an existing CUT system.
- [ ] Advanced performance management.
- [ ] Integrations with external CUT systems, SSO, payroll, email, or document services.
- [ ] Asset management, library/ICT/finance clearance, or other departmental workflows.
- [ ] Automated individual "attrition risk" scoring or decision-making.

## Suggested build order in this repository

1. Phase 0 requirements and safe navigation/branding transition.
2. Phase 1 permissions and HR/employee dashboards.
3. Phase 2 employee register and self-service requests.
4. Phase 3 contracts, onboarding, and probation.
5. Phase 4 leave workflow completion.
6. Phase 7 exit workflow redesign.
7. Phase 6 engagement and retention.
8. Phase 8 reports and analytics.
9. Phase 5 confidential case management after CUT's access policy is confirmed.
10. Phase 9 test, migration, pilot, and deployment work throughout—not only at the end.
