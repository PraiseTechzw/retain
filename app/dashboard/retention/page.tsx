import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import {
  ExitInterviewForm,
  HistoricalExitImportForm,
  RehireEligibilityForm,
  RunRetentionEarlyWarningAnalysisForm,
  RetentionFollowupForm,
  RetentionFollowupUpdateForm,
} from "@/components/retention-forms";
import { getRoleKey } from "@/lib/role-utils";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type EmployeeRow = {
  id: string;
  employee_number: string;
  full_name: string;
  email: string | null;
  department_id: string | null;
  employment_status: string;
};

function assertQuery<T>(result: { data: T | null; error: { code?: string } | null }, label: string) {
  if (result.error) {
    console.error(`Unable to load ${label}.`, { code: result.error.code });
    throw new Error(`Unable to load ${label}. Apply the latest Supabase migration and try again.`);
  }
  return result.data;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString();
}

export default async function Page() {
  const context = await resolveDashboardUserContext();
  const role = getRoleKey(context.userRole);
  if (role !== "hr" && role !== "hr_manager") redirect("/dashboard");

  const supabase = await createClient();
  const [
    employeeResult,
    pastExitResult,
    completedExitResult,
    interviewResult,
    invitationResult,
    responseResult,
    followupResult,
    warningResult,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_number, full_name, email, department_id, employment_status")
      .order("full_name"),
    supabase
      .from("past_exit_records")
      .select("id, employee_id, exit_date, reason_category, good_standing, open_to_return")
      .order("exit_date", { ascending: false }),
    supabase
      .from("exit_cases")
      .select("id, employee_id, last_day, exit_type, good_standing, open_to_return")
      .in("status", ["completed", "finalized"])
      .order("last_day", { ascending: false }),
    supabase
      .from("exit_interviews")
      .select("id, exit_case_id, interview_date, would_return, responses")
      .order("interview_date", { ascending: false }),
    supabase
      .from("post_exit_survey_invitations")
      .select("id, exit_case_id, wave, due_on, status, submitted_at")
      .order("due_on", { ascending: false }),
    supabase
      .from("post_exit_survey_responses")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("retention_followup_flags")
      .select("id, employee_id, reason, status, follow_up_on, outcome")
      .order("created_at", { ascending: false }),
    supabase
      .from("early_warning_flags")
      .select("id, department, quarter_start, current_rate_pct, baseline_rate_pct, warning_threshold_pct, active_headcount, average_tenure_months, engagement_score, engagement_respondents, explanation, raised_at")
      .eq("status", "open")
      .order("raised_at", { ascending: false }),
  ]);

  const employees = assertQuery(employeeResult, "the employee register") ?? [];
  const pastExits = assertQuery(pastExitResult, "historical exits") ?? [];
  const completedExits = assertQuery(completedExitResult, "completed exits") ?? [];
  const interviews = assertQuery(interviewResult, "exit interviews") ?? [];
  const invitations = assertQuery(invitationResult, "post-exit survey invitations") ?? [];
  assertQuery(responseResult, "post-exit survey responses");
  const followups = assertQuery(followupResult, "HR follow-ups") ?? [];
  const allWarningFlags = assertQuery(warningResult, "department early-warning flags") ?? [];
  const now = new Date();
  const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3 + 1;
  const currentQuarterStart = `${now.getUTCFullYear()}-${String(quarterMonth).padStart(2, "0")}-01`;
  const warningFlags = allWarningFlags.filter(
    (flag) => flag.quarter_start === currentQuarterStart,
  );
  const employeeById = new Map(
    (employees as EmployeeRow[]).map((employee) => [employee.id, employee]),
  );
  const interviewCaseIds = new Set(
    interviews.map((interview) => interview.exit_case_id),
  );
  const casesWithoutInterview = completedExits
    .filter((exit) => !interviewCaseIds.has(exit.id))
    .map((exit) => {
      const employee = employeeById.get(exit.employee_id);
      return {
        id: exit.id,
        employee_name: employee?.full_name ?? "Unknown employee",
        employee_number: employee?.employee_number ?? "-",
        last_day: exit.last_day,
      };
    });
  const pastRehireCandidates = pastExits.filter(
    (record) => record.good_standing && record.open_to_return,
  );
  const currentRehireCandidates = completedExits.filter(
    (record) => record.good_standing && record.open_to_return,
  );
  const rehireCount = pastRehireCandidates.length + currentRehireCandidates.length;
  const openInvitations = invitations.filter(
    (invitation) => invitation.status === "scheduled" || invitation.status === "sent",
  );

  return (
    <DashboardShell userName={context.userName} userRole={context.userRole}>
      <PageFrame
        title="Retention and exit follow-up"
        description="Historical exit baseline, confidential departure feedback, former staff re-engagement, and HR-owned support actions."
        action={
          <Link
            href="/dashboard/reports"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View turnover report
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Historical exits" value={pastExits.length} />
          <Metric label="Exit interviews" value={interviews.length} />
          <Metric label="Surveys awaiting action" value={openInvitations.length} />
          <Metric label="Survey responses" value={responseResult.count ?? 0} />
          <Metric label="Former staff open to return" value={rehireCount} />
        </div>

        <div className="mt-7 grid gap-6">
          <HistoricalExitImportForm />

          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
            <div>
              <h2 className="text-lg font-semibold">Baseline from recorded history</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Historical exits are included in quarterly turnover reporting. Rates use the current report denominator and should be treated as provisional until HR verifies migrated dates and headcount.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold tabular-nums">{pastExits.length + completedExits.length}</span>
              <span className="max-w-28 text-sm text-muted-foreground">linked exit records</span>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Department early-warning analysis</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Advisory department trends only: current-quarter attrition must reach 125% of its average across at least two completed, reportable quarters. Groups with fewer than five exits or staff are withheld. Individual employees are never assigned a risk score.
                </p>
              </div>
              <RunRetentionEarlyWarningAnalysisForm />
            </div>
            {warningFlags.length ? (
              <div className="grid gap-3">
                {warningFlags.map((flag) => (
                  <article key={flag.id} className="grid gap-2 rounded-xl bg-muted/40 p-4 md:grid-cols-[minmax(12rem,0.7fr)_1fr] md:items-start">
                    <div>
                      <h3 className="font-semibold">{flag.department}</h3>
                      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {flag.current_rate_pct}% current quarter · {flag.baseline_rate_pct}% baseline
                      </p>
                    </div>
                    <p className="text-sm leading-6">{flag.explanation}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                label="department warning flags"
                description="No departments currently meet the advisory threshold. Refresh the analysis after new exit or engagement data is recorded."
              />
            )}
          </section>

          <ExitInterviewForm exits={casesWithoutInterview} />

          <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Former staff rehire pool</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Includes only former staff recorded as leaving in good standing and open to returning.
                </p>
              </div>
              <Status>{rehireCount} eligible records</Status>
            </div>
            {rehireCount ? (
              <DataTable
                columns={["Former employee", "Employee number", "Exit date", "Primary reason", "Source", "Contact"]}
                rows={[
                  ...pastRehireCandidates.map((record) => {
                    const employee = employeeById.get(record.employee_id);
                    return [
                      employee?.full_name ?? "Unknown employee",
                      employee?.employee_number ?? "-",
                      dateLabel(record.exit_date),
                      record.reason_category,
                      "Historical",
                      employee?.email ?? "No email recorded",
                    ];
                  }),
                  ...currentRehireCandidates.map((record) => {
                    const employee = employeeById.get(record.employee_id);
                    return [
                      employee?.full_name ?? "Unknown employee",
                      employee?.employee_number ?? "-",
                      dateLabel(record.last_day),
                      record.exit_type,
                      "HR exit case",
                      employee?.email ?? "No email recorded",
                    ];
                  }),
                ]}
              />
            ) : (
              <EmptyState
                label="rehire pool entries"
                description="Import historical exits and mark good standing and open-to-return when those details are known."
              />
            )}
            <div className="mt-6 grid gap-3">
              <h3 className="font-medium">Confirm rehire eligibility for completed exits</h3>
              {completedExits.map((record) => {
                const employee = employeeById.get(record.employee_id);
                return (
                  <article key={record.id} className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 lg:flex-row lg:items-center">
                    <div className="min-w-52">
                      <p className="font-medium">{employee?.full_name ?? "Unknown employee"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{employee?.employee_number ?? "-"} · {dateLabel(record.last_day)}</p>
                    </div>
                    <RehireEligibilityForm
                      exitCaseId={record.id}
                      goodStanding={record.good_standing}
                      openToReturn={record.open_to_return}
                    />
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Exit interview record</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confidential structured responses, visible only to HR staff.
              </p>
            </div>
            {interviews.length ? (
              <DataTable
                columns={["Former employee", "Interview date", "Primary reason", "Would return"]}
                rows={interviews.map((interview) => {
                  const exit = completedExits.find((item) => item.id === interview.exit_case_id);
                  const employee = exit ? employeeById.get(exit.employee_id) : undefined;
                  return [
                    employee?.full_name ?? "Unknown employee",
                    dateLabel(interview.interview_date),
                    interview.responses?.reason_for_leaving ?? "Not recorded",
                    interview.would_return == null ? "Not recorded" : interview.would_return ? "Yes" : "No",
                  ];
                })}
              />
            ) : (
              <EmptyState
                label="exit interviews"
                description="Record an interview against a completed HR exit case."
              />
            )}
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Post-exit survey schedule</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completing an exit schedules three- and six-month follow-ups. A daily Supabase job sends them when due.
                </p>
              </div>
              <Link href="/dashboard/reports" className="text-sm font-medium text-primary hover:underline">
                Open report
              </Link>
            </div>
            {invitations.length ? (
              <DataTable
                columns={["Former employee", "Follow-up", "Due", "Status", "Submitted"]}
                rows={invitations.map((invitation) => {
                  const exit = completedExits.find((item) => item.id === invitation.exit_case_id);
                  const employee = exit ? employeeById.get(exit.employee_id) : undefined;
                  return [
                    employee?.full_name ?? "Former employee",
                    `${invitation.wave}-month survey`,
                    dateLabel(invitation.due_on),
                    <Status key={`${invitation.id}-status`} tone={invitation.status === "failed" ? "amber" : invitation.status === "submitted" ? "green" : "default"}>
                      {invitation.status}
                    </Status>,
                    dateLabel(invitation.submitted_at),
                  ];
                })}
              />
            ) : (
              <EmptyState
                label="scheduled surveys"
                description="Survey follow-ups are scheduled when an HR exit case is completed."
              />
            )}
          </section>

          <RetentionFollowupForm
            employees={(employees as EmployeeRow[])
              .filter((employee) => employee.employment_status !== "exited")
              .map(({ id, employee_number, full_name }) => ({ id, employee_number, full_name }))}
          />

          <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">HR follow-up queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These are manually raised individual support actions. Separate turnover flags are department-level trends, not employee risk scores or decisions.
              </p>
            </div>
            {followups.length ? (
              <div className="grid gap-4">
                {followups.map((followup) => {
                  const employee = employeeById.get(followup.employee_id);
                  return (
                    <article key={followup.id} className="grid gap-3 rounded-xl bg-muted/40 p-4 xl:grid-cols-[minmax(12rem,0.65fr)_minmax(15rem,1fr)_minmax(22rem,1.4fr)] xl:items-center">
                      <div>
                        <p className="font-medium">{employee?.full_name ?? "Unknown employee"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{employee?.employee_number ?? "-"} · Follow-up {dateLabel(followup.follow_up_on)}</p>
                      </div>
                      <p className="text-sm leading-6">{followup.reason}</p>
                      <RetentionFollowupUpdateForm id={followup.id} status={followup.status} />
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                label="HR follow-ups"
                description="Record an agreed support action above. The system does not automatically infer an employee's likelihood of leaving."
              />
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
    </section>
  );
}
