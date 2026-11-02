import Link from "next/link";
import {
  DashboardShell,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, ClipboardList, UserRound } from "lucide-react";
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
    return { request, employee };
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
            <Metric icon={ClipboardList} label="Total exit cases" value={requests.length} />
            <Metric icon={CheckCircle2} label="Completed exits" value={completedCount} />
            <Metric icon={Clock3} label="Open cases" value={openCount} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <div>
              <p className="font-semibold">Exit case queue</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {reasons} categorized reason{reasons === 1 ? "" : "s"} are available for turnover analysis.
              </p>
            </div>
            <Status tone="blue">Live records</Status>
          </div>
          {requests.length ? (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(150px,1fr)_130px_150px_110px] gap-4 border-b border-border/70 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>Employee</span><span>Reason</span><span>Status</span><span>Last working day</span><span />
              </div>
              <div className="divide-y divide-border/60">
                {rows.map(({ request, employee }) => (
                  <ExitCaseRow key={request.id} request={request} employee={employee} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState label="exit requests" />
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ExitCaseRow({
  request,
  employee,
}: {
  request: Awaited<ReturnType<typeof getExitRequests>>[number];
  employee: { full_name?: string | null; employee_number?: string | null } | null;
}) {
  const status = String(request.status).toLowerCase();
  const isComplete = ["completed", "finalized"].includes(status);
  const lastDay = request.last_day ? new Date(`${request.last_day}T12:00:00`) : null;
  const daysUntil = lastDay ? Math.ceil((lastDay.getTime() - Date.now()) / 86400000) : null;
  const urgency = !isComplete && daysUntil != null && daysUntil <= 14;
  return (
    <Link href={`/dashboard/exit-requests/${request.id}`} className="group grid gap-3 px-5 py-4 transition hover:bg-muted/35 md:grid-cols-[minmax(0,1.5fr)_minmax(150px,1fr)_130px_150px_110px] md:items-center md:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold group-hover:text-primary">{employee?.full_name ?? "Unknown employee"}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{employee?.employee_number ?? "No employee number"}</span>
        </span>
      </div>
      <div className="pl-13 text-sm capitalize text-muted-foreground md:pl-0">{(request.reason_category ?? request.reason ?? "Not recorded").replaceAll("_", " ")}</div>
      <div className="pl-13 md:pl-0"><Status tone={isComplete ? "green" : status === "under_review" ? "blue" : "amber"}>{status.replaceAll("_", " ")}</Status></div>
      <div className={`flex items-center gap-2 pl-13 text-sm md:pl-0 ${urgency ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
        <CalendarDays className="size-4" aria-hidden="true" />
        {lastDay ? formatDate(lastDay) : "Not set"}
        {urgency && <span className="text-xs">· soon</span>}
      </div>
      <span className="hidden items-center gap-1 text-sm font-semibold text-primary md:inline-flex">Review <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(value);
}
