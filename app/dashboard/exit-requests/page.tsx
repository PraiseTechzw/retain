import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
import { RealtimeTurnoverRefresh } from "@/components/realtime-turnover-refresh";
import { getEmployees, getExitRequests } from "@/lib/supabase/data";
import { requireDashboardCapability } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } =
    await requireDashboardCapability("manageExitCases");
  const [requests, employeeRows] = await Promise.all([
    getExitRequests(),
    getEmployees(),
  ]);
  const employeeOptions = employeeRows.flatMap((employee) => {
    if (!employee.id || !employee.employee_number || !employee.full_name)
      return [];
    return [
      {
        id: employee.id,
        employee_number: employee.employee_number,
        full_name: employee.full_name,
      },
    ];
  });
  const rows = requests.map((request) => {
    const employee = Array.isArray(request.employees)
      ? request.employees[0]
      : request.employees;
    return [
      <Link
        key={request.id}
        href={`/dashboard/exit-requests/${request.id}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {employee?.employee_number ?? "—"} ·{" "}
        {employee?.full_name ?? "Unknown employee"}
      </Link>,
      (request.reason_category ?? request.reason ?? "Not recorded").replaceAll("_", " "),
      <Status
        key="status"
        tone={request.status === "completed" ? "green" : "amber"}
      >
        {request.status}
      </Status>,
      request.last_day ?? "—",
      <Link
        key="review"
        href={`/dashboard/exit-requests/${request.id}`}
        className="font-semibold text-primary hover:underline"
      >
        Review request
      </Link>,
    ];
  });
  const completedCount = requests.filter((request) =>
    ["completed", "finalized"].includes(String(request.status).toLowerCase()),
  ).length;
  const openCount = requests.length - completedCount;
  const reasons = new Set(
    requests
      .map((request) => request.reason_category)
      .filter((reason): reason is string => Boolean(reason)),
  ).size;
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <RealtimeTurnoverRefresh />
      <PageFrame
        title="Exit Requests"
        description="Capture historical and new exit reasons linked to employee records."
        action={<OperationsPanel mode="exit" employees={employeeOptions} />}
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Total exit cases" value={requests.length} />
            <Metric label="Completed exits" value={completedCount} />
            <Metric label="Open cases" value={openCount} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">Linked exit history</p>
              <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-300/80">
                {reasons} categorized reason{reasons === 1 ? "" : "s"} are available for turnover analysis.
              </p>
            </div>
            <Status tone="green">Live cases</Status>
          </div>
          {requests.length ? (
            <DataTable
              columns={["Employee", "Reason", "Status", "Last day", "Action"]}
              rows={rows}
            />
          ) : (
            <EmptyState label="exit requests" />
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
