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
import { getDepartments, getEmployees } from "@/lib/supabase/data";
import { requireDashboardCapability } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } =
    await requireDashboardCapability("manageEmployees");
  const [employees, departments] = await Promise.all([
    getEmployees(),
    getDepartments(),
  ]);
  const rows = employees.map((employee) => {
    const department = Array.isArray(employee.departments)
      ? employee.departments[0]
      : employee.departments;
    return [
      <Link
        key={employee.id}
        href={`/dashboard/employees/${employee.id}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {employee.employee_number} · {employee.full_name}
      </Link>,
      `${employee.job_title ?? "Unassigned"} · ${department?.name ?? "No department"}`,
      <Status
        key="status"
        tone={employee.employment_status === "active" ? "green" : "blue"}
      >
        {employee.employment_status}
      </Status>,
      employee.appointment_date ?? "—",
    ];
  });
  const activeCount = employees.filter(
    (employee) => employee.employment_status === "active",
  ).length;
  const historicalCount = employees.length - activeCount;
  const departmentCount = new Set(
    employees.map((employee) => {
      const department = Array.isArray(employee.departments)
        ? employee.departments[0]
        : employee.departments;
      return department?.name ?? "Unassigned";
    }),
  ).size;
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <RealtimeTurnoverRefresh />
      <PageFrame
        title="Employee Management"
        description="Capture current and historical employee records for turnover tracking."
        action={
          <OperationsPanel
            mode="employee"
            departments={departments.flatMap((department) =>
              department.id && department.name
                ? [{ id: department.id, name: department.name }]
                : [],
            )}
          />
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Total records" value={employees.length} />
            <Metric label="Active employees" value={activeCount} />
            <Metric label="Departments represented" value={departmentCount} />
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Employee record register</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {historicalCount} historical record{historicalCount === 1 ? "" : "s"} available for exit linking.
                </p>
              </div>
              <Status tone="green">Live register</Status>
            </div>
          </div>
          {employees.length === 0 ? (
            <EmptyState label="employees" />
          ) : (
            <DataTable
              columns={["Employee", "Role & department", "Status", "Appointment"]}
              rows={rows}
            />
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
