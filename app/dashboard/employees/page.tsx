import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
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
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Employee Management"
        description="Maintain employee records and monitor institutional transitions."
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
        {employees.length === 0 ? (
          <EmptyState label="employees" />
        ) : (
          <DataTable
            columns={["Employee", "Role & department", "Status", "Appointment"]}
            rows={rows}
          />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
