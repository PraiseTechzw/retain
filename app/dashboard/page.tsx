import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
import { AdministratorOverview } from "@/components/dashboard/administrator-overview";
import { RealtimeTurnoverRefresh } from "@/components/realtime-turnover-refresh";
import { getRoleKey, requireDashboardCapability } from "@/lib/auth-role";
import {
  getDepartments,
  getEmployees,
  getExitRequests,
  getQuarterlyTurnoverSummary,
} from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } =
    await requireDashboardCapability("manageEmployees");
  if (getRoleKey(userRole) === "administrator") {
    return <AdministratorOverview userName={userName} userRole={userRole} />;
  }

  const [employees, exits, departments, turnover] = await Promise.all([
    getEmployees(),
    getExitRequests(),
    getDepartments(),
    getQuarterlyTurnoverSummary(),
  ]);

  const activeEmployees = employees.filter(
    (employee) => employee.employment_status === "active",
  ).length;
  const historicalEmployees = employees.filter(
    (employee) => employee.employment_status !== "active",
  ).length;
  const completedExits = exits.filter((exit) =>
    ["completed", "finalized"].includes(String(exit.status).toLowerCase()),
  );
  const reasonCounts = completedExits.reduce<Record<string, number>>(
    (counts, exit) => {
      const reason = exit.reason_category || "Not recorded";
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const topReasons = Object.entries(reasonCounts)
    .sort(([, first], [, second]) => second - first)
    .slice(0, 5);
  const recentExits = completedExits.slice(0, 5).map((exit) => {
    const employee = Array.isArray(exit.employees)
      ? exit.employees[0]
      : exit.employees;
    return [
      employee?.employee_number ?? "—",
      employee?.full_name ?? "Unknown employee",
      exit.reason_category?.replaceAll("_", " ") ?? "Not recorded",
      exit.last_day ?? "—",
    ];
  });
  const latestQuarter = turnover[0];
  const departmentsForForm = departments.flatMap((department) =>
    department.id && department.name
      ? [{ id: department.id, name: department.name }]
      : [],
  );
  const employeeOptions = employees.flatMap((employee) =>
    employee.id && employee.employee_number && employee.full_name
      ? [
          {
            id: employee.id,
            employee_number: employee.employee_number,
            full_name: employee.full_name,
          },
        ]
      : [],
  );

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <RealtimeTurnoverRefresh />
      <PageFrame
        title="Workforce overview"
        description="A live view of employee records, linked exits, and turnover reasons."
        action={
          <div className="flex flex-wrap gap-2">
            <OperationsPanel mode="employee" departments={departmentsForForm} />
            <OperationsPanel mode="exit" employees={employeeOptions} />
          </div>
        }
      >
        <div className="space-y-6">
          <section className="rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-slate-900 p-6 text-primary-foreground shadow-lg md:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-primary-foreground/70">
                  Live workforce intelligence
                </p>
                <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
                  Know who is here, who has left, and why.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">
                  Capture current and historical employee records, link every exit to the employee record, and identify the strongest turnover drivers.
                </p>
              </div>
              <Link
                href="/dashboard/reports"
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
              >
                Open full analysis
              </Link>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total employees" value={employees.length} tone="blue" />
            <Metric label="Active employees" value={activeEmployees} tone="green" />
            <Metric label="Historical employees" value={historicalEmployees} tone="amber" />
            <Metric label="Linked exits" value={completedExits.length} tone="violet" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Turnover snapshot</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Latest live quarterly result from linked exit history.
                  </p>
                </div>
                <Status tone="green">Live</Status>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Snapshot label="Latest quarter" value={latestQuarter ? formatQuarter(latestQuarter.quarter_start) : "—"} />
                <Snapshot label="Quarter exits" value={latestQuarter?.exits ?? 0} />
                <Snapshot
                  label="Turnover rate"
                  value={latestQuarter?.attrition_rate_pct == null ? "N/A" : `${latestQuarter.attrition_rate_pct}%`}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="font-semibold">Quick actions</h2>
              <div className="mt-4 grid gap-2">
                <Link href="/dashboard/employees" className="rounded-xl border p-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                  Manage employee records
                </Link>
                <Link href="/dashboard/exit-requests" className="rounded-xl border p-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                  Review linked exit cases
                </Link>
                <Link href="/dashboard/reports" className="rounded-xl border p-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                  Analyse turnover reasons
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <ReasonList reasons={topReasons} />
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Recent linked exits</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Historical exit reasons connected to employee records.
                  </p>
                </div>
                <Link href="/dashboard/exit-requests" className="text-sm font-semibold text-primary hover:underline">
                  View all
                </Link>
              </div>
              {recentExits.length ? (
                <div className="mt-4">
                  <DataTable columns={["Number", "Employee", "Reason", "Last day"]} rows={recentExits} />
                </div>
              ) : (
                <p className="mt-6 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                  No completed linked exits have been recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "violet";
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className={`mb-4 h-1.5 w-12 rounded-full ${tone === "blue" ? "bg-blue-500" : tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-violet-500"}`} />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Snapshot({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ReasonList({ reasons }: { reasons: Array<[string, number]> }) {
  const max = Math.max(...reasons.map(([, count]) => count), 1);
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-semibold">Top turnover reasons</h2>
      <p className="mt-1 text-sm text-muted-foreground">Most common reasons from completed linked exits.</p>
      <div className="mt-5 space-y-4">
        {reasons.length ? reasons.map(([reason, count]) => (
          <div key={reason}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="capitalize">{reason.replaceAll("_", " ")}</span>
              <strong>{count}</strong>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No exit reasons recorded yet.</p>}
      </div>
    </div>
  );
}

function formatQuarter(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", {
    month: "short",
    year: "numeric",
  });
}
